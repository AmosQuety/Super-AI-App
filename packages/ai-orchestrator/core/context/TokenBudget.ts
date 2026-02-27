/**
 * Immutable value object describing the effective token budget for a request.
 *
 * The budget is constructed once per call via {@link createTokenBudget} and
 * passed through the context pipeline. It is never mutated after creation.
 */
export interface TokenBudget {
  /**
   * Hard ceiling imposed by the model (from {@link ProviderCapabilities.maxContextTokens}).
   */
  readonly modelMaxTokens: number;

  /**
   * Tokens held back for the model's own reply.
   * Typically 512–2048 depending on expected response length.
   */
  readonly reservedForResponse: number;

  /**
   * Tokens available for the prompt (history + system prompt + RAG chunks).
   * Derived: `modelMaxTokens - reservedForResponse`.
   */
  readonly availableForContext: number;
}

/**
 * Creates an immutable {@link TokenBudget}.
 *
 * @param modelMaxTokens       - Provider capability ceiling.
 * @param reservedForResponse  - Tokens to hold back for the reply.
 */
export function createTokenBudget(
  modelMaxTokens: number,
  reservedForResponse: number,
): TokenBudget {
  if (reservedForResponse >= modelMaxTokens) {
    throw new RangeError(
      `reservedForResponse (${reservedForResponse}) must be less than modelMaxTokens (${modelMaxTokens}).`,
    );
  }
  return Object.freeze({
    modelMaxTokens,
    reservedForResponse,
    availableForContext: modelMaxTokens - reservedForResponse,
  });
}
