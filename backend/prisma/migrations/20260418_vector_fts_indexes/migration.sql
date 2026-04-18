-- Migration: 20260418_vector_fts_indexes
-- Adds pgvector ivfflat index and GIN full-text search index on DocumentChunk.
--
-- NOTE: The ivfflat index with lists = 100 gives best performance once the
-- table exceeds ~100,000 rows. It is safe to apply on smaller tables but
-- the query planner may prefer a sequential scan until data volume grows.
--
-- After applying this migration, run:
--   VACUUM ANALYZE "DocumentChunk";
-- ivfflat requires the table statistics to be up-to-date before the index
-- is used by the planner.

-- UP

-- Vector similarity index (cosine distance, matches the <=> operator used in retrieval)
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_ivfflat_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index (matches to_tsvector used in the fallback path)
CREATE INDEX IF NOT EXISTS "DocumentChunk_content_gin_idx"
  ON "DocumentChunk"
  USING gin(to_tsvector('english', content));

-- DOWN

DROP INDEX IF EXISTS "DocumentChunk_embedding_ivfflat_idx";
DROP INDEX IF EXISTS "DocumentChunk_content_gin_idx";
