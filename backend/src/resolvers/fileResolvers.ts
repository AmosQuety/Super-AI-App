// apps/backend/src/resolvers/fileResolvers.ts
import { CloudinaryService } from '../services/cloudinaryService';
import { DocumentProcessor } from '../services/documentProcessor';

export const fileResolvers = {
  Mutation: {
    processFileForAI: async (_: any, { fileUrl, mimeType }: { fileUrl: string, mimeType: string }) => {
      try {
        const processor = new DocumentProcessor();
        const extractedText = await processor.extractTextFromUrl(fileUrl, mimeType);
        
        return {
          success: true,
          content: extractedText,
          processedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          content: '',
          error: error.message
        };
      }
    }
  }
};