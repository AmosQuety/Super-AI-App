import type { TokenUsage } from './TokenUsage.js';

/**
 * A single streaming chunk emitted by a provider during a streamed completion.
 *
 * Consumers should accumulate {@link delta} values until {@link isDone} is true.
 * The final chunk (where {@link isDone} is `true`) will carry {@link usage} if
 * the provider supports per-stream token counting.
 */
export interface StreamResponse {
  /**
   * Correlation ID shared across all chunks belonging to the same request.
   * Matches the {@link FinalResponse.id} if the stream is later folded.
   */
  readonly id: string;
  /** Incremental text content for this chunk. May be an empty string. */
  readonly delta: string;
  /** The model that generated this chunk. */
  readonly model: string;
  /** The identifier of the provider emitting this chunk. */
  readonly provider: string;
  /**
   * `true` on the final chunk — signals the consumer to flush and stop reading.
   * No further chunks will be emitted after this.
   */
  readonly isDone: boolean;
  /**
   * Token usage totals, populated only on the last chunk (`isDone === true`).
   * May be `undefined` if the provider does not support per-stream accounting.
   */
  readonly usage?: TokenUsage;
}
