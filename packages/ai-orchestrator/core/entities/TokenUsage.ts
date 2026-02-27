/**
 * Tracks token consumption for a single completion request.
 * Used for billing accountability, rate-limit tracking, and telemetry.
 */
export interface TokenUsage {
  /** Number of tokens consumed by the input (prompt). */
  readonly promptTokens: number;
  /** Number of tokens generated in the completion. */
  readonly completionTokens: number;
  /** Total tokens used (prompt + completion). */
  readonly totalTokens: number;
}

/**
 * Factory for constructing a {@link TokenUsage} value object.
 * Automatically computes {@link TokenUsage.totalTokens} if not supplied.
 */
export function createTokenUsage(
  promptTokens: number,
  completionTokens: number,
  totalTokens?: number,
): TokenUsage {
  return Object.freeze({
    promptTokens,
    completionTokens,
    totalTokens: totalTokens ?? promptTokens + completionTokens,
  });
}
