import { PrismaClient } from '@prisma/client';
import { DocumentProcessor } from './documentProcessor';
import { logger } from '../utils/logger';
import { TaskService } from './taskService';

type EmbeddingService = {
  getEmbedding(text: string): Promise<number[]>;
};

type DocumentIngestionDeps = {
  prisma: PrismaClient;
  embeddingService: EmbeddingService;
  sourceBuffer?: Buffer;
  sourceMimeType?: string;
  taskService?: TaskService;
  taskId?: string;
};

const processor = new DocumentProcessor();
const CHUNK_SIZE_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 400;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_VERSION = 1;

/**
 * Process a document asynchronously after upload.
 *
 * Strategy:
 *   1. Extract and chunk document text.
 *   2. Attempt vector embedding for each chunk. A failure on any individual
 *      chunk (e.g. 403 API-disabled, rate-limit) is caught and logged, but the
 *      chunk is still persisted WITHOUT an embedding so that the text-search
 *      fallback can use it.
 *   3. The document is always marked `ready` once text has been extracted and
 *      chunks saved — even if zero embeddings succeeded.  The retrieval layer
 *      handles both paths (vector cosine OR full-text ILIKE).
 */
export async function processDocument(
  documentId: string,
  { prisma, embeddingService, sourceBuffer, sourceMimeType, taskService, taskId }: DocumentIngestionDeps,
): Promise<void> {
  logger.info('[ingestion] starting', { documentId });

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error(`Document not found: ${documentId}`);

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'processing' },
  });
  logger.info('[ingestion] status updated', { documentId, status: 'processing' });

  if (taskService && taskId) {
    await taskService.markProcessing(taskId, document.userId, {
      documentId,
      stage: 'starting',
    });
  }

  try {
    // ── 1. Text extraction ────────────────────────────────────────────────────
    const fullText = sourceBuffer
      ? await processor.extractText(sourceBuffer, sourceMimeType || document.fileType)
      : await processor.extractTextFromUrl(document.fileUrl, document.fileType);

    logger.info('[ingestion] text extracted', { documentId, characterCount: fullText.length });

    if (taskService && taskId) {
      await taskService.updateProgress(taskId, document.userId, 15, {
        documentId,
        stage: 'text-extracted',
        characterCount: fullText.length,
      });
    }

    if (!fullText.trim()) throw new Error('Could not extract text from document');

    // ── 2. Chunking ───────────────────────────────────────────────────────────
    const textChunks = processor.chunkText(fullText, CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);
    logger.info('[ingestion] chunking complete', {
      documentId,
      chunkCount: textChunks.length,
      chunkSizeChars: CHUNK_SIZE_CHARS,
      overlapChars: CHUNK_OVERLAP_CHARS,
    });

    if (textChunks.length === 0) throw new Error('Document produced no chunks');

    if (taskService && taskId) {
      await taskService.updateProgress(taskId, document.userId, 25, {
        documentId,
        stage: 'chunking-complete',
        chunkCount: textChunks.length,
      });
    }

    // Idempotent: clear any previous partial run.
    await prisma.documentChunk.deleteMany({ where: { documentId } });
    logger.info('[ingestion] cleared existing chunks', { documentId });

    // ── 3. Embed each chunk (non-fatal) ───────────────────────────────────────
    let embeddedCount = 0;
    let skippedCount = 0;

    const MAX_CONCURRENT_CHUNKS = parseInt(process.env.EMBEDDING_CONCURRENCY ?? '5', 10);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let batchStart = 0; batchStart < textChunks.length; batchStart += MAX_CONCURRENT_CHUNKS) {
      const batch = textChunks.slice(batchStart, batchStart + MAX_CONCURRENT_CHUNKS);
      
      await Promise.all(batch.map(async (rawContent, batchOffset) => {
        const i = batchStart + batchOffset;
        const content = rawContent.trim();
        if (!content) return;

        logger.info('[ingestion] processing chunk', {
          documentId,
          chunkIndex: i,
          totalChunks: textChunks.length,
        });

        // Always create the chunk row first — ensures full-text fallback works
        // even when embedding is unavailable.
        const chunk = await prisma.documentChunk.create({
          data: {
            content,
            chunkIndex: i,
            embeddingModel: EMBEDDING_MODEL,
            embeddingVersion: EMBEDDING_VERSION,
            documentId,
          },
        });

        const retryEmbedding = async (attempt = 1): Promise<number[]> => {
          try {
            return await embeddingService.getEmbedding(content);
          } catch (err: any) {
            const is429 = err.status === 429 || (err.message && err.message.includes('429'));
            if (is429 && attempt <= 3) {
              logger.warn(`[ingestion] 429 Rate limit hit on chunk ${i}. Retrying in ${attempt * 2000}ms...`);
              await sleep(2000 * attempt);
              return retryEmbedding(attempt + 1);
            }
            throw err;
          }
        };

        // Attempt embedding — failure is non-fatal.
        try {
          const vector = await retryEmbedding();
          const vectorString = `[${vector.join(',')}]`;

          await prisma.$executeRaw`
            UPDATE "DocumentChunk"
            SET embedding = ${vectorString}::vector
            WHERE id = ${chunk.id}
          `;

          embeddedCount += 1;
          logger.info('[ingestion] chunk embedded', { documentId, chunkIndex: i });
        } catch (embeddingError: unknown) {
          skippedCount += 1;
          const msg = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
          logger.warn('[ingestion] embedding skipped (non-fatal) — will use text search fallback', {
            documentId,
            chunkIndex: i,
            reason: msg.slice(0, 200),
          });
          // Chunk is still saved without an embedding vector
        }
      }));

      if (taskService && taskId) {
        const completedChunks = Math.min(batchStart + batch.length, textChunks.length);
        const progress = 25 + Math.round((completedChunks / textChunks.length) * 65);
        await taskService.updateProgress(taskId, document.userId, progress, {
          documentId,
          stage: 'embedding-progress',
          completedChunks,
          totalChunks: textChunks.length,
          embeddedCount,
          skippedCount,
        });
      }
    }

    logger.info('[ingestion] embeddings complete', { documentId, embeddedCount, skippedCount });

    // ── 4. Mark ready ─────────────────────────────────────────────────────────
    // Always mark ready as long as text and chunks are available.
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'ready' },
    });
    logger.info('[ingestion] status updated', { documentId, status: 'ready' });

    if (taskService && taskId) {
      await taskService.completeTask(taskId, document.userId, {
        resultReference: documentId,
        metadata: {
          documentId,
          embeddedCount,
          skippedCount,
        },
      });
    }

  } catch (error) {
    // A truly fatal error (e.g. text extraction failed, no text at all).
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed' },
    });

    logger.error('[ingestion] failed', {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (taskService && taskId) {
      await taskService.failTask(taskId, document.userId, error instanceof Error ? error.message : String(error), {
        metadata: {
          documentId,
        },
      });
    }

    throw error;
  }
}