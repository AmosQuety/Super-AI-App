// src/resolvers/sendMessageWithResponse.ts
import { AuthenticationError, ApolloError } from "apollo-server-express"; // Removed unused UserInputError
import { AppContext } from "./types/context";
import { IntelligentMatcher, createIntelligentMatcher } from "../IntelligentMatcher/IntelligentMatcher";
import customResponses from "../IntelligentMatcher/customResponses";
import { pubsub } from './subscriptionResolvers';
import { DocumentProcessor } from "../services/documentProcessor";
import { CircuitBreaker } from "../IntelligentMatcher/safety/CircuitBreaker";
import { checkUserRateLimit } from "../auth/UserRateLimit"; // Import it


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
    if (!context.user) throw new AuthenticationError("Login required");

    checkUserRateLimit(context.user.userId, 'chat'); 
    
    // 1. Verify Chat Ownership
    const chat = await context.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.userId !== context.user.userId) throw new AuthenticationError("Unauthorized");

    try {
      let finalPrompt = content?.trim() || '';
      let hasFileAttachment = false;

      // 2. Handle Immediate File Attachment (The "Chat with File" feature)
      if (fileUri && fileMimeType) {
        try {
          // Use the extractTextFromUrl method (ensure it exists in DocumentProcessor now)
          const extractedText = await documentProcessor.extractTextFromUrl(fileUri, fileMimeType);
          finalPrompt = `User Request: ${finalPrompt}\n\nAttached File Content:\n${extractedText}`;
          hasFileAttachment = true;
        } catch (e: any) {
          console.error("File processing error:", e);
        }
      }

      // 3. RAG SEARCH (The "Long Term Memory") 🧠
      // If no direct attachment, check the Vector Database for relevant knowledge
      if (!hasFileAttachment && finalPrompt.length > 5) {
        try {
          console.log("🔍 Searching knowledge base for:", finalPrompt.substring(0, 50));
          
          // A. Generate Embedding
          const queryEmbedding = await context.geminiAIService.getEmbedding(finalPrompt);
          const vectorString = `[${queryEmbedding.join(",")}]`;

          // B. Search Supabase
          // 👇 CHANGE 1: Lower threshold to 0.3 (Very permissive)
          const relatedChunks: any[] = await context.prisma.$queryRaw`
            SELECT content, similarity 
            from match_documents(
              ${vectorString}::vector, 
              0.3,  
              5, 
              ${context.user.userId}
            )
          `;

          // 👇 CHANGE 2: Log exactly what it found
          console.log("📊 RAG Debug Results:");
          relatedChunks.forEach((c, i) => {
             console.log(`   Chunk ${i} (${(c.similarity * 100).toFixed(1)}% match): ${c.content.substring(0, 50)}...`);
          });

          
          if (relatedChunks.length > 0) {
            console.log(`✅ Found ${relatedChunks.length} relevant memory chunks.`);
            
            const knowledgeContext = relatedChunks.map(c => c.content).join("\n---\n");
            
       // C. Inject Context into Prompt
           finalPrompt = `
You are a helpful AI assistant with access to the user's personal documents.

CONTEXT FROM DOCUMENTS:
${knowledgeContext}

USER QUESTION:
${finalPrompt}

INSTRUCTIONS:
1. If the user's question is related to the CONTEXT above, use it to answer accurately.
2. If the question is general (like "Hi", "Tell me a joke", or general knowledge) and NOT related to the documents, IGNORE the context and answer normally using your own knowledge.
3. Do not mention "I found this in the documents" unless necessary. Just answer naturally.
`;

          }
        } catch (ragError) {
          console.error("⚠️ RAG Search failed (ignoring):", ragError);
        }
      }

      // 4. Save User Message
      const userMessage = await context.prisma.message.create({
        data: {
          chatId,
          role: "user",
          content: content || `[Attached: ${fileName}]`,
          imageUrl, fileName, fileUri, fileMimeType
        },
      });

      // 5. Generate Response
      let aiResponse = "";
      
      // Try Custom Matcher first (for simple "Hi", "Thanks")
      if (!hasFileAttachment) {
         try {
            const matchResult = await matcherCircuitBreaker.execute(async () => {
              const matcher = await getIntelligentMatcher();
              return await matcher.findBestMatch(content);
            });
            if (matchResult.match && matchResult.confidence >= 0.8) {
               // FIX: Ensure it's a string (fallback to empty string if null)
               aiResponse = matchResult.suggestedResponse || "";
            }
         } catch (e) {}
      }

      // If no custom match (or custom match returned empty), ask Gemini
      if (!aiResponse) {
         aiResponse = await context.geminiAIService.generateContent(finalPrompt);
      }

      // 6. Save AI Response
      const aiMessage = await context.prisma.message.create({
        data: { chatId, role: "assistant", content: aiResponse },
      });

      await pubsub.publish('MESSAGE_ADDED', { messageAdded: { ...aiMessage, chatId } });

      return { userMessage, aiMessage, usedCustomResponse: false };

    } catch (error: any) {
      console.error("Chat Error:", error);
      throw new ApolloError(error.message);
    }
  },
};