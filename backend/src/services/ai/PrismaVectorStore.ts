import { PrismaClient } from '@prisma/client';
import { IVectorStore, DocumentChunk, CompletionOptions } from '@super-ai/ai-orchestrator';
import { GeminiProvider } from './GeminiProvider';
import { DocumentRetrievalService } from './DocumentRetrievalService';

export class PrismaVectorStore implements IVectorStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: GeminiProvider, // Re-uses GeminiProvider for text->vector embedding
  ) {}

  async search(query: string, topK: number, options?: CompletionOptions): Promise<DocumentChunk[]> {
    const userId = options?.tenantContext?.tenantId;
    if (!userId) {
      // Opt-out of RAG if no user context is provided (e.g. anonymous calls or legacy queries that don't need doc context)
      return [];
    }

    const retrievalService = new DocumentRetrievalService(this.prisma, this.provider);
    return retrievalService.retrieveRelevantChunks(userId, query, { topK });
  }
}
