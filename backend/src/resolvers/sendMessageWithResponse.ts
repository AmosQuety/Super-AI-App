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
import { logger } from "../utils/logger";

const MAX_HISTORY_TURNS = 20; // cap to avoid blowing context window

// Dynamic system prompt builder — injects user identity + preferences into Blaze's context
interface UserPrefs {
  tone?: string;           // 'casual' | 'formal'
  detail?: string;         // 'concise' | 'detailed'
  techDepth?: string;      // 'beginner' | 'intermediate' | 'expert'
  responseFormat?: string; // 'prose' | 'bullets' | 'mixed'
  role?: string;
  domain?: string;
  goals?: string;
  language?: string;
}

const buildSystemPrompt = (user: { name?: string | null; email: string }, prefs?: UserPrefs | null) => {
  const firstName = (user.name || user.email).split(' ')[0].split('@')[0];

  const toneInstruction = (() => {
    if (prefs?.tone === 'formal') return 'Use a formal, professional tone at all times.';
    if (prefs?.tone === 'casual') return 'Use a friendly, casual tone — feel free to be conversational.';
    return 'Match the tone of the conversation naturally.';
  })();

  const detailInstruction = (() => {
    if (prefs?.detail === 'concise') return 'Keep responses short and to the point. Avoid over-explaining.';
    if (prefs?.detail === 'detailed') return 'Provide thorough, in-depth answers with context and examples.';
    return 'Calibrate response length to the complexity of the question.';
  })();

  const techInstruction = (() => {
    if (prefs?.techDepth === 'beginner') return 'Explain concepts from scratch. Avoid jargon. Use analogies.';
    if (prefs?.techDepth === 'intermediate') return 'Assume basic familiarity. Define specialized terms briefly.';
    if (prefs?.techDepth === 'expert') return 'Skip fundamentals. Use precise technical language. Be direct.';
    return 'Gauge the user\'s level from their messages and adjust accordingly.';
  })();

  const formatInstruction = (() => {
    if (prefs?.responseFormat === 'bullets') return 'Prefer bullet points and structured lists where possible.';
    if (prefs?.responseFormat === 'prose') return 'Write in flowing prose paragraphs, not bullet lists.';
    if (prefs?.responseFormat === 'mixed') return 'Use a mix of prose and bullets depending on what fits best.';
    return 'Choose the most appropriate format for each response.';
  })();

  const contextLines = [
    prefs?.role ? `- Their professional role is: ${prefs.role}` : '',
    prefs?.domain ? `- Their primary domain/tech stack is: ${prefs.domain}` : '',
    prefs?.goals ? `- What they're currently working toward: ${prefs.goals}` : '',
    prefs?.language && prefs.language.toLowerCase() !== 'english'
      ? `- Respond in ${prefs.language} unless they write in a different language.`
      : '',
  ].filter(Boolean).join('\n');

  return `
You are Blaze, a helpful, intelligent, and conversational AI assistant built into Xemora.

The user logged in is ${user.name ? `"${user.name}" (${user.email})` : user.email}. Address them by first name ("${firstName}") where natural.

${contextLines}

Instructions:
- ${toneInstruction}
- ${detailInstruction}
- ${techInstruction}
- ${formatInstruction}
- Maintain context across the entire conversation.
- If external documents are provided, use them to answer the user's question directly.
- If you don't know something, say so honestly.
`.trim();
};

const summarizeHistory = (messages: Array<{ role: string; content: string }>): string => {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join(' ')
    .slice(0, 1000); // simple truncation for now (can upgrade later)
};

const buildContents = (
  history: Array<{ role: string; content: string }>,
  currentUserMessage: string,
  systemPrompt: string,
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
    parts: [{ text: systemPrompt.trim() }],
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
    { chatId, content, imageUrl, fileName, fileUri, fileMimeType, activeDocumentIds }: any,
    context: AppContext
  ) => {
    // 1. Auth & Identification
    const userId = context.user?.userId || (context.user as any)?.id;
    if (!userId) throw new AuthenticationError("Login required");

    // 2. Verify Chat Ownership + Fetch User Profile (with preferences)
    const [chat, userProfile] = await Promise.all([
      context.prisma.chat.findUnique({ where: { id: chatId } }),
      context.prisma.user.findUnique({ 
        where: { id: userId },
        select: { name: true, email: true, preferences: true },
      }),
    ]);
    if (!chat || chat.userId !== userId) throw new AuthenticationError("Unauthorized");

    let task: any = null;

    let userPrefs = null;
    if (userProfile?.preferences) {
      try { userPrefs = JSON.parse(userProfile.preferences); } catch {}
    }

    const systemPrompt = buildSystemPrompt(
      { name: userProfile?.name, email: userProfile?.email || '' },
      userPrefs,
    );

    try {
      task = await context.taskService.createTask({
        userId,
        feature: "chat_response",
        metadata: {
          chatId,
          hasAttachment: Boolean(fileUri || imageUrl),
          activeDocumentCount: activeDocumentIds?.length ?? 0,
        },
      });

      await context.taskService.markProcessing(task.id, userId, {
        chatId,
        hasAttachment: Boolean(fileUri || imageUrl),
        activeDocumentCount: activeDocumentIds?.length ?? 0,
      });

      await context.taskService.updateProgress(task.id, userId, 10, {
        phase: "context-preparation",
        chatId,
      });

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
          logger.error("File processing error:", e);
        }
      }

      // Build native Gemini multi-turn contents
      const contents = buildContents(priorMessages, modelUserMessage, systemPrompt);

      // 5. RAG SEARCH (Long Term Memory)
      if (!hasFileAttachment && originalUserMessage.length > 5) {
        try {
          const hasActiveDocs = activeDocumentIds && activeDocumentIds.length > 0;
          const dynamicTopK = hasActiveDocs ? 8 : 3;

          const retrievalService = new DocumentRetrievalService(context.prisma, context.geminiAIService);
          const relatedChunks = await retrievalService.retrieveRelevantChunks(
            userId, 
            originalUserMessage, 
            { 
              topK: dynamicTopK,
              documentIds: activeDocumentIds 
            }
          );

          if (relatedChunks.length > 0) {
            const knowledgeContext = relatedChunks
              .slice(0, dynamicTopK)
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
          logger.warn("⚠️ RAG Search failed:", ragError);
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

      await context.taskService.updateProgress(task.id, userId, 35, {
        phase: "user-message-saved",
        chatId,
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

          await context.taskService.updateProgress(task.id, userId, 80, {
            phase: "ai-response-generated",
            chatId,
          });

           usedGemini = true; // Mark that we hit the API
         } catch (providerError: any) {
           logger.error("LLM generation failed:", providerError);
           aiResponse = "I am having trouble reaching the AI provider right now due to high demand. Please retry in a few moments.";
         }
      }

      // 8. Save AI Response
      const aiMessage = await context.prisma.message.create({
        data: { chatId, role: "assistant", content: aiResponse },
      });

      await context.taskService.updateProgress(task.id, userId, 95, {
        phase: "assistant-message-saved",
        chatId,
      });

      // --- STRATEGY 1: INCREMENT USAGE (Only if we used the API) ---
      if (usedGemini) {
        await AIManager.incrementUsage(userId, 'chat');
      }

      await pubsub.publish('MESSAGE_ADDED', { messageAdded: { ...aiMessage, chatId } });

      await context.taskService.completeTask(task.id, userId, {
        resultReference: aiMessage.id,
        metadata: {
          chatId,
          usedCustomResponse: !usedGemini,
        },
      });

      return { userMessage, aiMessage, usedCustomResponse: !usedGemini };

    } catch (error: any) {
      logger.error("Chat Error:", error);
      if (task) {
        await context.taskService.failTask(task.id, userId, error.message || "Failed to send message with response", {
          metadata: {
            chatId,
          },
        });
      }
      throw new ApolloError(error.message);
    }
  },
};