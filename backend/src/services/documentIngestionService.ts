import { PrismaClient } from '@prisma/client';
import { DocumentProcessor } from './documentProcessor';

type EmbeddingService = {
  getEmbedding(text: string): Promise<number[]>;
};

type DocumentIngestionDeps = {
  prisma: PrismaClient;
  embeddingService: EmbeddingService;
  sourceBuffer?: Buffer;
  sourceMimeType?: string;
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
  { prisma, embeddingService, sourceBuffer, sourceMimeType }: DocumentIngestionDeps,
): Promise<void> {
  console.info('[ingestion] starting', { documentId });

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error(`Document not found: ${documentId}`);

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'processing' },
  });
  console.info('[ingestion] status updated', { documentId, status: 'processing' });

  try {
    // ── 1. Text extraction ────────────────────────────────────────────────────
    const fullText = sourceBuffer
      ? await processor.extractText(sourceBuffer, sourceMimeType || document.fileType)
      : await processor.extractTextFromUrl(document.fileUrl, document.fileType);

    console.info('[ingestion] text extracted', { documentId, characterCount: fullText.length });

    if (!fullText.trim()) throw new Error('Could not extract text from document');

    // ── 2. Chunking ───────────────────────────────────────────────────────────
    const textChunks = processor.chunkText(fullText, CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);
    console.info('[ingestion] chunking complete', {
      documentId,
      chunkCount: textChunks.length,
      chunkSizeChars: CHUNK_SIZE_CHARS,
      overlapChars: CHUNK_OVERLAP_CHARS,
    });

    if (textChunks.length === 0) throw new Error('Document produced no chunks');

    // Idempotent: clear any previous partial run.
    await prisma.documentChunk.deleteMany({ where: { documentId } });
    console.info('[ingestion] cleared existing chunks', { documentId });

    // ── 3. Embed each chunk (non-fatal) ───────────────────────────────────────
    let embeddedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < textChunks.length; i++) {
      const content = textChunks[i].trim();
      if (!content) continue;

      console.info('[ingestion] processing chunk', {
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

      // Attempt embedding — failure is non-fatal.
      try {
        const vector = await embeddingService.getEmbedding(content);
        const vectorString = `[${vector.join(',')}]`;

        await prisma.$executeRaw`
          UPDATE "DocumentChunk"
          SET embedding = ${vectorString}::vector
          WHERE id = ${chunk.id}
        `;

        embeddedCount += 1;
        console.info('[ingestion] chunk embedded', { documentId, chunkIndex: i });
      } catch (embeddingError: unknown) {
        skippedCount += 1;
        const msg = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
        console.warn('[ingestion] embedding skipped (non-fatal) — will use text search fallback', {
          documentId,
          chunkIndex: i,
          reason: msg.slice(0, 200),
        });
        // Chunk is still saved without an embedding vector — the retrieval
        // service will fall back to ILIKE / full-text search for this document.
      }
    }

    console.info('[ingestion] embeddings complete', { documentId, embeddedCount, skippedCount });

    // ── 4. Mark ready ─────────────────────────────────────────────────────────
    // Always mark ready as long as text and chunks are available.
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'ready' },
    });
    console.info('[ingestion] status updated', { documentId, status: 'ready' });

  } catch (error) {
    // A truly fatal error (e.g. text extraction failed, no text at all).
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed' },
    });

    console.error('[ingestion] failed', {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}