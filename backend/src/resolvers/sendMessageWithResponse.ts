// src/resolvers/sendMessageWithResponse.ts - ENHANCED VERSION
import { AuthenticationError, UserInputError, ApolloError } from "apollo-server-express";
import { AppContext } from "./types/context";
import { IntelligentMatcher } from "../IntelligentMatcher/IntelligentMatcher";
import customResponses from "../IntelligentMatcher/customResponses";
import { pubsub } from './subscriptionResolvers';
import { DocumentProcessor } from "../services/documentProcessor";
import { GeminiAPIError } from "../services/geminiAIService"; // ADD THIS IMPORT

const intelligentMatcher = new IntelligentMatcher(customResponses);
const documentProcessor = new DocumentProcessor();

// Enhanced prompt builder
const buildEnhancedPrompt = (
  userMessage: string, 
  fileContent: string, 
  fileName?: string, 
  fileType?: string
): string => {
  const cleanedFileContent = fileContent?.trim() || '';
  const cleanedUserMessage = userMessage?.trim() || '';

  if (!cleanedFileContent || 
      cleanedFileContent.startsWith('[Unable to process') || 
      cleanedFileContent.startsWith('[Error processing')) {
    
    if (cleanedUserMessage) {
      return `${cleanedUserMessage}\n\n[Note: Attached file "${fileName}" could not be processed]`;
    }
    
    return `Please help me with the file "${fileName}" (${fileType}). I've attached it but it couldn't be fully processed. Can you provide general guidance?`;
  }

  if (cleanedUserMessage && cleanedFileContent) {
    return `User Request: ${cleanedUserMessage}

Attached File: ${fileName} (${fileType})

File Content:
${cleanedFileContent}

Please analyze the file content and respond to the user's request.`;
  }

  if (cleanedFileContent) {
    return `Please analyze this file and provide a comprehensive summary:

File Name: ${fileName}
File Type: ${fileType}

Content:
${cleanedFileContent}

Provide insights, key points, and any relevant analysis.`;
  }

  return "Hello! How can I help you today?";
};

// REFACTOR: Enhanced error mapper for frontend consumption
const mapErrorForFrontend = (error: Error) => {
  if (error instanceof GeminiAPIError) {
    return {
      message: error.message,
      code: error.statusCode?.toString() || '500',
      type: error.errorType || 'UNKNOWN_ERROR',
      retryable: error.retryable !== false,
      details: `AI Service Error: ${error.message}`
    };
  }

  // Handle other known error types
  if (error.message.includes('timeout')) {
    return {
      message: 'Request timeout - please try again',
      code: '408',
      type: 'TIMEOUT_ERROR',
      retryable: true,
      details: 'The AI service took too long to respond'
    };
  }

  if (error.message.includes('network') || error.message.includes('fetch')) {
    return {
      message: 'Network connection issue - please check your connection',
      code: '503',
      type: 'NETWORK_ERROR',
      retryable: true,
      details: 'Unable to reach the AI service'
    };
  }

  // Default error
  return {
    message: 'An unexpected error occurred',
    code: '500',
    type: 'UNKNOWN_ERROR',
    retryable: false,
    details: error.message
  };
};

export const sendMessageWithResponse = {
  sendMessageWithResponse: async (
    _: any,
    { 
      chatId, 
      content, 
      imageUrl, 
      fileName, 
      fileUri, 
      fileMimeType 
    }: { 
      chatId: string; 
      content: string;
      imageUrl?: string;
      fileName?: string;
      fileUri?: string;
      fileMimeType?: string;
    },
    context: AppContext
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to send a message");
    }

    // Verify the chat exists and belongs to the user
    const chat = await context.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new UserInputError("Chat not found");
    }

    if (chat.userId !== context.user.id) {
      throw new AuthenticationError("You can only send messages to your own chats");
    }

    try {
      let finalContent = content?.trim() || '';
      let hasFileAttachment = false;
      let extractedText = '';

      // Step 1: Process file attachment if present
      if (fileUri && fileMimeType) {
        try {
          console.log(`📁 Processing attached file: ${fileName}, Type: ${fileMimeType}`);
          
          extractedText = await documentProcessor.extractTextFromUrl(fileUri, fileMimeType);
          
          console.log(`✅ File processed. Extracted ${extractedText?.length || 0} characters`);
          
          // Enhance the prompt with file context
          finalContent = buildEnhancedPrompt(content, extractedText, fileName, fileMimeType);
          hasFileAttachment = true;
          
          console.log(`🔧 Enhanced prompt length: ${finalContent.length} characters`);
          
        } catch (fileError: any) {
          console.error('❌ File processing failed:', fileError.message);
          
          // Build a fallback prompt
          finalContent = content?.trim() 
            ? `${content}\n\n[Note: Could not process attached file "${fileName}"]`
            : `[User attached file: ${fileName} (${fileMimeType}) - processing failed]`;
        }
      }

      // Validate finalContent before proceeding
      if (!finalContent || finalContent.trim().length === 0) {
        finalContent = "Hello! I've sent you a message.";
        console.warn('⚠️ Empty prompt detected, using fallback');
      }

      console.log(`📤 Final prompt to Gemini (${finalContent.length} chars): ${finalContent.substring(0, 150)}...`);

      // Step 2: Add user message with file metadata
      const userMessage = await context.prisma.message.create({
        data: {
          chatId,
          role: "user",
          content: content || `[Attached: ${fileName}]`,
          imageUrl: imageUrl || null,
          fileName: fileName || null,
          fileUri: fileUri || null,
          fileMimeType: fileMimeType || null,
        },
      });

      let aiResponse: string;
      let usedCustomResponse = false;

      // Step 3: Try intelligent matcher first (only for text without files)
      if (!hasFileAttachment && content?.trim()) {
        try {
          const matchResult = await intelligentMatcher.findBestMatch(content.trim());
          if (matchResult.match && matchResult.confidence >= 0.7) {
            aiResponse = matchResult.suggestedResponse || "I'm here to help!";
            usedCustomResponse = true;
            console.log("✅ Used custom response:", matchResult.match);
          } else {
            // Fall back to Gemini AI
            aiResponse = await context.geminiAIService.generateContent(finalContent);
            console.log("🤖 Used Gemini AI (no match found)");
          }
        } catch (matcherError) {
          console.log("⚠️ IntelligentMatcher error, using Gemini:", matcherError);
          aiResponse = await context.geminiAIService.generateContent(finalContent);
        }
      } else {
        // For file attachments, always use Gemini
        console.log("📄 Sending to Gemini with file content...");
        aiResponse = await context.geminiAIService.generateContent(finalContent);
        console.log(`✅ Gemini response received (${aiResponse?.length || 0} chars)`);
      }

      // Step 4: Add AI response message
      const aiMessage = await context.prisma.message.create({
        data: {
          chatId,
          role: "assistant",
          content: aiResponse,
        },
      });

      // Step 5: Publish to subscription
      await pubsub.publish('MESSAGE_ADDED', {
        messageAdded: {
          ...aiMessage,
          chatId: chatId,
        },
      });

      return {
        userMessage,
        aiMessage,
        usedCustomResponse,
      };

    } catch (error: any) {
      console.error("❌ Error in sendMessageWithResponse:", error);
      
      // REFACTOR: Enhanced error handling with structured error information
      const frontendError = mapErrorForFrontend(error);
      
      console.error("🔍 Error details for frontend:", {
        originalError: error.message,
        mappedError: frontendError,
        stack: error.stack
      });

      // Use ApolloError for structured error handling
      throw new ApolloError(
        frontendError.message,
        frontendError.code,
        {
          errorType: frontendError.type,
          retryable: frontendError.retryable,
          details: frontendError.details,
          originalMessage: error.message,
          timestamp: new Date().toISOString()
        }
      );
    }
  },
};