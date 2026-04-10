// src/resolvers/sendMessageWithResponse.ts
import { AuthenticationError, ApolloError } from "apollo-server-express";
import { AppContext } from "./types/context";
import { IntelligentMatcher, createIntelligentMatcher } from "../IntelligentMatcher/IntelligentMatcher";
import customResponses from "../IntelligentMatcher/customResponses";
import { pubsub } from './subscriptionResolvers';
import { DocumentProcessor } from "../services/documentProcessor";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import { AIManager } from "../utils/aiManager"; // Import our new Manager
import { DocumentRetrievalService } from "../services/ai/DocumentRetrievalService";

const MAX_HISTORY_TURNS = 20; // cap to avoid blowing context window

const SYSTEM_PROMPT = `
You are Blaze, a helpful, intelligent, and conversational assistant.
- Be clear, concise, and natural.
- Maintain context across the conversation.
- Be friendly but professional.
- If external context (documents) is provided, use it when relevant.
`;

const summarizeHistory = (messages: Array<{ role: string; content: string }>): string => {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join(' ')
    .slice(0, 1000); // simple truncation for now (can upgrade later)
};

const buildContents = (
  history: Array<{ role: string; content: string }>,
  currentUserMessage: string
): Array<{ role: string; parts: Array<{ text: string }> }> => {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  const older = history.slice(0, -MAX_HISTORY_TURNS);

  const contents = recent
    .map((msg) => {
      const normalizedRole = msg.role?.toLowerCase();
      if (!['assistant', 'user'].includes(normalizedRole)) {
        return null;
      }

      const safeRole = normalizedRole === 'assistant' ? 'model' : 'user';
      const text = msg.content.replace(/\s+/g, ' ').trim();

      return {
        role: safeRole,
        parts: [{ text }],
      };
    })
    .filter((msg): msg is { role: string; parts: Array<{ text: string }> } => {
      return msg !== null && msg.parts[0].text.length > 0;
    });

  if (older.length > 0) {
    const summary = summarizeHistory(older);
    contents.unshift({
      role: 'user',
      parts: [{
        text: `Conversation summary (earlier context): ${summary}`,
      }],
    });
  }

  contents.unshift({
    role: 'user', // Gemini-compatible system instruction workaround
    parts: [{ text: SYSTEM_PROMPT.trim() }],
  });

  contents.push({
    role: 'user',
    parts: [{ text: currentUserMessage }],
  });

  return contents;
};

// Lazy init for Matcher
let intelligentMatcher: IntelligentMatcher | null = null;
const matcherCircuitBreaker = new CircuitBreaker(3, 60000);

const getIntelligentMatcher = async (): Promise<IntelligentMatcher> => {
  if (!intelligentMatcher) {
    intelligentMatcher = createIntelligentMatcher(customResponses, { optimizeFor: "speed", debugMode: false });
  }
  return intelligentMatcher;
}

const documentProcessor = new DocumentProcessor();

export const sendMessageWithResponse = {
  sendMessageWithResponse: async (
    _: any,
    { chatId, content, imageUrl, fileName, fileUri, fileMimeType }: any,
    context: AppContext
  ) => {
    // 1. Auth & Identification
    const userId = context.user?.userId || (context.user as any)?.id;
    if (!userId) throw new AuthenticationError("Login required");

    // 2. Verify Chat Ownership
    const chat = await context.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.userId !== userId) throw new AuthenticationError("Unauthorized");

    try {
      const originalUserMessage = content?.trim() || '';
      let modelUserMessage = originalUserMessage;
      let hasFileAttachment = false;

      // 3. Build conversation memory context from previous messages in this chat.
      const priorMessages = await context.prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      });

      // 4. Handle File Attachment
      if (fileUri && fileMimeType?.startsWith('text/')) {
        try {
          const extractedText = await documentProcessor.extractTextFromUrl(fileUri, fileMimeType);
          hasFileAttachment = true;
          modelUserMessage = `FILE CONTENT:\n${extractedText}\n\nUSER MESSAGE:\n${originalUserMessage}`;
        } catch (e: any) {
          console.error("File processing error:", e);
        }
      }

      // Build native Gemini multi-turn contents
      const contents = buildContents(priorMessages, modelUserMessage);

      // 5. RAG SEARCH (Long Term Memory)
      if (!hasFileAttachment && originalUserMessage.length > 5) {
        try {
          const retrievalService = new DocumentRetrievalService(context.prisma, context.geminiAIService);
          const relatedChunks = await retrievalService.retrieveRelevantChunks(userId, originalUserMessage, { topK: 3 });

          if (relatedChunks.length > 0) {
            const knowledgeContext = relatedChunks
              .slice(0, 3)
              .map((c) => c.content)
              .join('\n---\n');

            const lastIndex = contents.length - 1;
            contents[lastIndex] = {
              role: 'user',
              parts: [{
                text: `CONTEXT:\n${knowledgeContext}\n\nUSER MESSAGE:\n${originalUserMessage}`,
              }],
            };
          }
        } catch (ragError) {
          console.error("⚠️ RAG Search failed:", ragError);
        }
      }

      // 6. Save User Message
      const userMessage = await context.prisma.message.create({
        data: {
          chatId,
          role: "user",
          content: content || `[Attached: ${fileName}]`,
          imageUrl, fileName, fileUri, fileMimeType
        },
      });

      // 7. Generate Response (with Quota Logic)
      let aiResponse = "";
      let usedGemini = false;
      
      // Step A: Try Custom Matcher first (FREE - No quota used)
      if (!hasFileAttachment) {
         try {
            const matchResult = await matcherCircuitBreaker.execute(async () => {
              const matcher = await getIntelligentMatcher();
              return await matcher.findBestMatch(content);
            });
            if (matchResult.match && matchResult.confidence >= 0.8) {
               aiResponse = matchResult.suggestedResponse || "";
            }
         } catch (e) {}
      }

      // Step B: If no custom match, check Quota and call Gemini
      if (!aiResponse) {
         // --- STRATEGY 1: CHECK DB QUOTA ---
         try {
          await AIManager.checkQuota(userId, 'chat');

          let fullStreamedText = '';
          aiResponse = await context.geminiAIService.generateContentStream(contents, async (delta: string) => {
            fullStreamedText += delta;

            await pubsub.publish('MESSAGE_CHUNK_ADDED', {
              messageChunkAdded: {
                chatId,
                delta,
                fullContent: fullStreamedText,
                isDone: false,
              },
            });
          });

          await pubsub.publish('MESSAGE_CHUNK_ADDED', {
            messageChunkAdded: {
              chatId,
              delta: '',
              fullContent: aiResponse,
              isDone: true,
            },
          });

           usedGemini = true; // Mark that we hit the API
         } catch (providerError: any) {
           console.error("LLM generation failed:", providerError);
           aiResponse = "I am having trouble reaching the AI provider right now due to high demand. Please retry in a few moments.";
         }
      }

      // 8. Save AI Response
      const aiMessage = await context.prisma.message.create({
        data: { chatId, role: "assistant", content: aiResponse },
      });

      // --- STRATEGY 1: INCREMENT USAGE (Only if we used the API) ---
      if (usedGemini) {
        await AIManager.incrementUsage(userId, 'chat');
      }

      await pubsub.publish('MESSAGE_ADDED', { messageAdded: { ...aiMessage, chatId } });

      return { userMessage, aiMessage, usedCustomResponse: !usedGemini };

    } catch (error: any) {
      console.error("Chat Error:", error);
      throw new ApolloError(error.message);
    }
  },
};