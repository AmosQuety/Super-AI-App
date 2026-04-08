import { PrismaClient } from '@prisma/client';
import type { DocumentChunk } from '@super-ai/ai-orchestrator';

export interface EmbeddingProvider {
  getEmbedding(text: string): Promise<number[]>;
}

export interface RetrieveRelevantChunksOptions {
  topK?: number;
  similarityThreshold?: number;
}

const DEFAULT_TOP_K = 3;
const MAX_TOP_K = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

export class DocumentRetrievalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async retrieveRelevantChunks(
    userId: string,
    query: string,
    options: RetrieveRelevantChunksOptions = {},
  ): Promise<DocumentChunk[]> {
    const normalizedQuery = query.trim();
    if (!userId || !normalizedQuery) {
      return [];
    }

    const requestedTopK = options.topK ?? DEFAULT_TOP_K;
    const topK = Math.min(MAX_TOP_K, Math.max(1, requestedTopK));
    const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    const queryEmbedding = await this.embeddingProvider.getEmbedding(normalizedQuery);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    const relatedChunks = await this.prisma.$queryRaw<Array<{ content: string; similarity: number | null }>>`
      SELECT content, similarity
      from match_documents(
        ${vectorString}::vector,
        ${similarityThreshold},
        ${topK},
        ${userId}
      )
    `;

    console.info('[rag] retrieval complete', {
      userId,
      queryLength: normalizedQuery.length,
      requestedTopK,
      appliedTopK: topK,
      retrievedCount: relatedChunks.length,
    });

    return relatedChunks
      .map((chunk) => ({
        content: chunk.content,
        score: chunk.similarity === null ? undefined : Number(chunk.similarity),
      }))
      .filter((chunk) => chunk.content.trim().length > 0)
      .slice(0, topK);
  }
}