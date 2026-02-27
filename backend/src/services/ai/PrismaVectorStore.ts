import { PrismaClient } from '@prisma/client';
import { IVectorStore, DocumentChunk, CompletionOptions } from '@super-ai/ai-orchestrator';
import { GeminiProvider } from './GeminiProvider';

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

    // 1. Convert text to vector using our existing GeminiProvider
    const queryEmbedding = await this.provider.getEmbedding(query);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 2. Perform Postgres pgvector search via the `match_documents` function
    // Format matches legacy graphql resolver behaviour exactly
    const relatedChunks: any[] = await this.prisma.$queryRaw`
      SELECT content, similarity 
      from match_documents(
        ${vectorString}::vector, 
        0.3,  
        ${topK}, 
        ${userId}
      )
    `;

    // 3. Map to orchestrator format
    return relatedChunks.map((chunk, index) => ({
      id: `chunk-${index}`,
      content: chunk.content,
      score: chunk.similarity,
    }));
  }
}
