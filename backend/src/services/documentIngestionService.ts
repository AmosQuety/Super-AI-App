import { PrismaClient } from '@prisma/client';
import { DocumentProcessor } from './documentProcessor';

type EmbeddingService = {
  getEmbedding(text: string): Promise<number[]>;
};

type DocumentIngestionDeps = {
  prisma: PrismaClient;
  embeddingService: EmbeddingService;
};

const processor = new DocumentProcessor();
const CHUNK_SIZE_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 400;
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_VERSION = 1;

/**
 * Process a document asynchronously after upload.
 * The document is marked ready only after text extraction, chunking, and
 * embedding persistence complete successfully.
 */
export async function processDocument(
  documentId: string,
  { prisma, embeddingService }: DocumentIngestionDeps,
): Promise<void> {
  console.info('[ingestion] starting', { documentId });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'processing' },
  });
  console.info('[ingestion] status updated', { documentId, status: 'processing' });

  try {
    const fullText = await processor.extractTextFromUrl(document.fileUrl, document.fileType);
    console.info('[ingestion] text extracted', { documentId, characterCount: fullText.length });

    if (!fullText.trim()) {
      throw new Error('Could not extract text from document');
    }

    const textChunks = processor.chunkText(fullText, CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);
    console.info('[ingestion] chunking complete', {
      documentId,
      chunkCount: textChunks.length,
      chunkSizeChars: CHUNK_SIZE_CHARS,
      overlapChars: CHUNK_OVERLAP_CHARS,
    });
    if (textChunks.length === 0) {
      throw new Error('Document produced no chunks');
    }

    // Keep retries idempotent by clearing any previous partial chunks first.
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });
    console.info('[ingestion] cleared existing chunks', { documentId });

    let persistedChunks = 0;
    for (let i = 0; i < textChunks.length; i++) {
      const content = textChunks[i].trim();
      if (!content) continue;

      console.info('[ingestion] embedding chunk', {
        documentId,
        chunkIndex: i,
        totalChunks: textChunks.length,
      });

      const vector = await embeddingService.getEmbedding(content);

      const chunk = await prisma.documentChunk.create({
        data: {
          content,
          chunkIndex: i,
          embeddingModel: EMBEDDING_MODEL,
          embeddingVersion: EMBEDDING_VERSION,
          documentId,
        },
      });

      const vectorString = `[${vector.join(',')}]`;

      await prisma.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${vectorString}::vector
        WHERE id = ${chunk.id}
      `;

      persistedChunks += 1;
    }

    console.info('[ingestion] embeddings persisted', { documentId, persistedChunks });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'ready' },
    });
    console.info('[ingestion] status updated', { documentId, status: 'ready' });
  } catch (error) {
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });

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