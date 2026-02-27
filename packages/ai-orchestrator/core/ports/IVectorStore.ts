import type { DocumentChunk } from '../context/DocumentChunk.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';

/**
 * Vector store port — semantic similarity search over a document corpus.
 *
 * Implementations can be backed by any vector database:
 *   - Pinecone, Weaviate, Qdrant (managed vector DBs)
 *   - pgvector (PostgreSQL extension)
 *   - In-memory HNSW (for testing / offline use)
 *
 * The core layer depends only on this interface; the concrete retrieval
 * adapter is supplied via dependency injection.
 */
export interface IVectorStore {
  /**
   * Retrieves the most semantically similar document chunks for a query.
   *
   * @param query - The user query or search string.
   * @param topK  - Maximum number of chunks to return, ordered by descending score.
   * @param options - Completion options, useful for extracting tenant context.
   * @returns Promise resolving to an array of {@link DocumentChunk}, may be empty.
   */
  search(query: string, topK: number, options?: CompletionOptions): Promise<DocumentChunk[]>;
}
