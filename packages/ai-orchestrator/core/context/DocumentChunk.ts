/**
 * A single fragment retrieved from a vector store for RAG injection.
 *
 * Immutable by convention — implementations must not mutate instances
 * after creation.
 */
export interface DocumentChunk {
  /** The text content of this chunk. */
  readonly content: string;

  /**
   * Optional source reference (e.g. document title, URL, or chunk ID).
   * Used to build citations if the consumer chooses to display them.
   */
  readonly source?: string;

  /**
   * Optional cosine or dot-product similarity score in [0, 1].
   * Higher = more relevant. May be undefined if the store does not expose scores.
   */
  readonly score?: number;
}
