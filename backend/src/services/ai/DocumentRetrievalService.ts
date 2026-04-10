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
const MAX_TOP_K = 5;
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
    if (!userId || !normalizedQuery) return [];

    const requestedTopK = options.topK ?? DEFAULT_TOP_K;
    const topK = Math.min(MAX_TOP_K, Math.max(1, requestedTopK));
    const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;

    // ── Path A: Vector (cosine) search ────────────────────────────────────────
    // Only attempted if embedding succeeds.  A failure drops us straight into
    // the full-text fallback so the user always gets *something*.
    try {
      const queryEmbedding = await this.embeddingProvider.getEmbedding(normalizedQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      const vectorResults = await this.prisma.$queryRaw<
        Array<{ content: string; similarity: number | null }>
      >`
        SELECT
          dc.content,
          1 - (dc.embedding <=> ${vectorString}::vector) AS similarity
        FROM "DocumentChunk" dc
        INNER JOIN "documents" d ON d.id = dc."documentId"
        WHERE d."userId"  = ${userId}
          AND d.status    = 'ready'
          AND dc.embedding IS NOT NULL
          AND (1 - (dc.embedding <=> ${vectorString}::vector)) >= ${similarityThreshold}
        ORDER BY dc.embedding <=> ${vectorString}::vector ASC
        LIMIT ${topK}
      `;

      console.info('[rag] vector retrieval complete', {
        userId,
        queryLength: normalizedQuery.length,
        requestedTopK,
        appliedTopK: topK,
        retrievedCount: vectorResults.length,
      });

      if (vectorResults.length > 0) {
        return vectorResults
          .map((chunk) => ({
            content: chunk.content,
            score: chunk.similarity === null ? undefined : Number(chunk.similarity),
          }))
          .filter((c) => c.content.trim().length > 0)
          .slice(0, topK);
      }

      // Vector search found nothing — fall through to full-text fallback.
      console.info('[rag] vector search returned 0 results, trying full-text fallback', { userId });
    } catch (embeddingError: unknown) {
      const msg = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
      console.warn('[rag] embedding failed, falling back to full-text search', {
        userId,
        reason: msg.slice(0, 200),
      });
    }

    // ── Path B: Full-text / keyword search fallback ───────────────────────────
    // Used when:
    //   • The embedding API is unavailable (403, rate-limit, etc.)
    //   • Vector search returned zero results
    //
    // Strategy:
    //   1. Try PostgreSQL full-text search (fast, ranked).
    //   2. If that returns nothing, fall back to ILIKE on individual keywords.
    //   3. Last resort: return the first N chunks of every ready document owned
    //      by the user so the AI always has *some* document context.
    return this.fullTextSearch(userId, normalizedQuery, topK);
  }

  // ── Full-text search ──────────────────────────────────────────────────────

  private async fullTextSearch(
    userId: string,
    query: string,
    topK: number,
  ): Promise<DocumentChunk[]> {
    // Build a tsquery from the first 10 meaningful words in the query.
    const tsQueryTerms = query
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 10)
      .join(' | '); // OR between terms for broader recall

    if (tsQueryTerms) {
      try {
        const ftResults = await this.prisma.$queryRaw<Array<{ content: string; rank: number }>>`
          SELECT
            dc.content,
            ts_rank(to_tsvector('english', dc.content), to_tsquery('english', ${tsQueryTerms})) AS rank
          FROM "DocumentChunk" dc
          INNER JOIN "documents" d ON d.id = dc."documentId"
          WHERE d."userId" = ${userId}
            AND d.status   = 'ready'
            AND to_tsvector('english', dc.content) @@ to_tsquery('english', ${tsQueryTerms})
          ORDER BY rank DESC
          LIMIT ${topK}
        `;

        if (ftResults.length > 0) {
          console.info('[rag] full-text search succeeded', {
            userId,
            retrievedCount: ftResults.length,
          });
          return ftResults
            .map((c) => ({ content: c.content, score: Number(c.rank) }))
            .filter((c) => c.content.trim().length > 0);
        }
      } catch (ftError) {
        console.warn('[rag] full-text search failed, trying ILIKE', {
          reason: ftError instanceof Error ? ftError.message : String(ftError),
        });
      }
    }

    // ── ILIKE keyword search ──────────────────────────────────────────────────
    const keywords = query
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (keywords.length > 0) {
      // Build WHERE dc.content ILIKE '%kw1%' OR dc.content ILIKE '%kw2%' …
      // We can't use parameterised Prisma tagged-template safely with dynamic
      // OR clauses, so we fall back to findMany with a filter on a single
      // representative keyword and accept some recall loss here.
      const primaryKeyword = `%${keywords[0]}%`;
      try {
        const ilikeResults = await this.prisma.$queryRaw<Array<{ content: string }>>`
          SELECT dc.content
          FROM "DocumentChunk" dc
          INNER JOIN "documents" d ON d.id = dc."documentId"
          WHERE d."userId" = ${userId}
            AND d.status   = 'ready'
            AND dc.content ILIKE ${primaryKeyword}
          LIMIT ${topK}
        `;

        if (ilikeResults.length > 0) {
          console.info('[rag] ILIKE search succeeded', {
            userId,
            keyword: keywords[0],
            retrievedCount: ilikeResults.length,
          });
          return ilikeResults
            .map((c) => ({ content: c.content, score: 0.1 }))
            .filter((c) => c.content.trim().length > 0);
        }
      } catch (ilikeError) {
        console.warn('[rag] ILIKE search failed', {
          reason: ilikeError instanceof Error ? ilikeError.message : String(ilikeError),
        });
      }
    }

    // ── Last resort: first N chunks of user's ready documents ─────────────────
    console.info('[rag] using first-chunks fallback', { userId });
    const fallbackChunks = await this.prisma.documentChunk.findMany({
      where: {
        document: {
          userId,
          status: 'ready',
        },
      },
      orderBy: { chunkIndex: 'asc' },
      take: topK,
      select: { content: true },
    });

    console.info('[rag] fallback retrieval complete', {
      userId,
      retrievedCount: fallbackChunks.length,
    });

    return fallbackChunks
      .map((c) => ({ content: c.content, score: 0.05 }))
      .filter((c) => c.content.trim().length > 0);
  }
}