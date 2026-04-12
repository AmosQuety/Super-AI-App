// script to create manual indexes
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to add custom pgvector and text-search indexes...');

  try {
    // 1. Create pgvector HNSW index for DocumentChunk.embedding
    console.log('Adding HNSW index on DocumentChunk.embedding...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw_idx 
      ON "DocumentChunk" USING hnsw (embedding vector_l2_ops);
    `);
    console.log('✅ HNSW index created successfully.');

    // 2. Create GIN index for text search on DocumentChunk.content
    console.log('Adding GIN full-text search index on DocumentChunk.content...');
    // We add an index on to_tsvector english
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS document_chunk_content_fts_idx 
      ON "DocumentChunk" USING GIN (to_tsvector('english', content));
    `);
    console.log('✅ GIN full-text index created successfully.');

  } catch (error) {
    console.error('❌ Error creating custom indexes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
