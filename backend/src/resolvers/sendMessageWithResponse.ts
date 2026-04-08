// src/resolvers/sendMessageWithResponse.ts
import { AuthenticationError, ApolloError } from "apollo-server-express";
import { AppContext } from "./types/context";
import { IntelligentMatcher, createIntelligentMatcher } from "../IntelligentMatcher/IntelligentMatcher";
import customResponses from "../IntelligentMatcher/customResponses";
import { pubsub } from './subscriptionResolvers';
import { DocumentProcessor } from "../services/documentProcessor";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import { AIManager } from "../utils/aiManager"; // Import our new Manager

const MAX_RECENT_MEMORY_MESSAGES = 12;
const MAX_OLDER_MEMORY_LINES = 8;
const MAX_LINE_LENGTH = 240;

const clipText = (input: string, max = MAX_LINE_LENGTH): string => {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
};

const toMemoryLine = (role: string, text: string): string => {
  const safeText = clipText(text);
  if (!safeText) return '';
  return `${role === 'assistant' ? 'Assistant' : 'User'}: ${safeText}`;
};

const buildMemoryContext = (
  history: Array<{ role: string; content: string }>
): string => {
  if (history.length === 0) return '';

  const older = history.slice(0, Math.max(0, history.length - MAX_RECENT_MEMORY_MESSAGES));
  const recent = history.slice(-MAX_RECENT_MEMORY_MESSAGES);

  const olderLines = older
    .slice(-MAX_OLDER_MEMORY_LINES)
    .map((m) => toMemoryLine(m.role, m.content))
    .filter(Boolean);

  const recentLines = recent
    .map((m) => toMemoryLine(m.role, m.content))
    .filter(Boolean);

  const olderSection = olderLines.length
    ? `Earlier conversation summary:\n${olderLines.map((line) => `- ${line}`).join('\n')}`
    : '';

  const recentSection = recentLines.length
    ? `Recent conversation turns:\n${recentLines.map((line) => `- ${line}`).join('\n')}`
    : '';

  return [olderSection, recentSection].filter(Boolean).join('\n\n');
};

const buildPromptWithMemory = (memoryContext: string, currentPrompt: string): string => {
  if (!memoryContext.trim()) return currentPrompt;

  return `
You are continuing an ongoing conversation.
Use the memory context below to stay consistent with prior turns.

MEMORY CONTEXT:
${memoryContext}

CURRENT USER REQUEST:
${currentPrompt}
`;
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
      let finalPrompt = content?.trim() || '';
      let hasFileAttachment = false;

      // 3. Build conversation memory context from previous messages in this chat.
      const priorMessages = await context.prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      });

      const memoryContext = buildMemoryContext(priorMessages);

      // 4. Handle File Attachment
      if (fileUri && fileMimeType) {
        try {
          const extractedText = await documentProcessor.extractTextFromUrl(fileUri, fileMimeType);
          finalPrompt = `User Request: ${finalPrompt}\n\nAttached File Content:\n${extractedText}`;
          hasFileAttachment = true;
        } catch (e: any) {
          console.error("File processing error:", e);
        }
      }

      finalPrompt = buildPromptWithMemory(memoryContext, finalPrompt);

      // 5. RAG SEARCH (Long Term Memory)
      if (!hasFileAttachment && content?.trim()?.length > 5) {
        try {
          const queryEmbedding = await context.geminiAIService.getEmbedding(content.trim());
          const vectorString = `[${queryEmbedding.join(",")}]`;

          const relatedChunks: any[] = await context.prisma.$queryRaw`
            SELECT content, similarity 
            from match_documents(
              ${vectorString}::vector, 
              0.3,  
              5, 
              ${userId}
            )
          `;

          if (relatedChunks.length > 0) {
            const knowledgeContext = relatedChunks.map(c => c.content).join("\n---\n");
            finalPrompt = `
You are a helpful AI assistant with access to the user's personal documents.
CONTEXT FROM DOCUMENTS:
${knowledgeContext}
USER QUESTION:
${finalPrompt}
INSTRUCTIONS:
1. Use the context to answer accurately if relevant.
2. If not relevant, answer normally.
`;
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
         await AIManager.checkQuota(userId, 'chat');

         aiResponse = await context.geminiAIService.generateContent(finalPrompt);
         usedGemini = true; // Mark that we hit the API
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