import { PrismaClient, Prisma } from '@prisma/client';
import type { DocumentChunk } from '@super-ai/ai-orchestrator';
import { redisClient } from '../../lib/redis';
import crypto from 'crypto';
import { recordLatency, getP95Latency } from '../../utils/logger';

export interface EmbeddingProvider {
  getEmbedding(text: string): Promise<number[]>;
}

export interface RetrieveRelevantChunksOptions {
  topK?: number;
  similarityThreshold?: number;
  documentIds?: string[];
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
    const t0 = performance.now();
    const normalizedQuery = query.trim();
    if (!userId || !normalizedQuery) return [];

    const requestedTopK = options.topK ?? DEFAULT_TOP_K;
    const topK = Math.min(MAX_TOP_K, Math.max(1, requestedTopK));
    const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;

    const queryHash = crypto.createHash('sha256').update(normalizedQuery).digest('hex');
    const docsHash = options.documentIds?.length 
      ? crypto.createHash('sha256').update([...options.documentIds].sort().join(',')).digest('hex').slice(0, 10) 
      : 'all';
      
    const resultCacheKey = `RAG:userId:${userId}:hash:${queryHash}:docs:${docsHash}:topK:${topK}`;

    // ── Check global Result Cache ─────────────────────────────────────────────
    if (redisClient) {
      const cachedResponse = await redisClient.get(resultCacheKey);
      if (cachedResponse) {
        console.info('[rag] Cache HIT for RAG result', { userId, queryHash });
        return JSON.parse(cachedResponse);
      }
    }

    let finalResults: DocumentChunk[] | null = null;

    // ── Path A: Vector (cosine) search ────────────────────────────────────────
    // Only attempted if embedding succeeds.  A failure drops us straight into
    // the full-text fallback so the user always gets *something*.
    try {
      let queryEmbedding: number[];
      const embedCacheKey = `embedding:${queryHash}`;
      
      if (redisClient) {
        const cachedEmbed = await redisClient.get(embedCacheKey);
        if (cachedEmbed) {
           queryEmbedding = JSON.parse(cachedEmbed);
        } else {
           queryEmbedding = await this.embeddingProvider.getEmbedding(normalizedQuery);
           await redisClient.set(embedCacheKey, JSON.stringify(queryEmbedding), 'EX', 86400); // 24 hours
        }
      } else {
        queryEmbedding = await this.embeddingProvider.getEmbedding(normalizedQuery);
      }
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
          ${options.documentIds && options.documentIds.length > 0 
            ? Prisma.sql`AND d.id IN (${Prisma.join(options.documentIds)})` 
            : Prisma.empty}
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
        finalResults = vectorResults
          .map((chunk) => ({
            content: chunk.content,
            score: chunk.similarity === null ? undefined : Number(chunk.similarity),
          }))
          .filter((c) => c.content.trim().length > 0)
          .slice(0, topK);
      } else {
        // Vector search found nothing — fall through to full-text fallback.
        console.info('[rag] vector search returned 0 results, trying full-text fallback', { userId });
      }
    } catch (embeddingError: unknown) {
      const msg = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
      console.warn('[rag] embedding failed, falling back to full-text search', {
        userId,
        reason: msg.slice(0, 200),
      });
    }

    // ── Path B: Full-text / keyword search fallback ───────────────────────────
    if (!finalResults) {
      finalResults = await this.fullTextSearch(userId, normalizedQuery, topK, options.documentIds);
    }

    if (redisClient && finalResults) {
      await redisClient.set(resultCacheKey, JSON.stringify(finalResults), 'EX', 180); // 3 minutes TTL
    }

    const t1 = performance.now();
    const duration = t1 - t0;
    recordLatency('RAG_Duration', duration);
    console.info(`[rag] Total retrieval time: ${duration.toFixed(2)}ms (p95: ${getP95Latency('RAG_Duration')?.toFixed(2)}ms)`);

    return finalResults || [];
  }

  // ── Full-text search ──────────────────────────────────────────────────────

  private async fullTextSearch(
    userId: string,
    query: string,
    topK: number,
    documentIds?: string[],
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
            ${documentIds && documentIds.length > 0 
              ? Prisma.sql`AND d.id IN (${Prisma.join(documentIds)})` 
              : Prisma.empty}
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