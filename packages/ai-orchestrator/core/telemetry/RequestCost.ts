import type { TokenUsage } from '../entities/TokenUsage.js';
import type { CostRate } from './CostRate.js';

/**
 * The computed monetary cost for a single completion request.
 */
export interface RequestCost {
  /** Cost incurred from prompt (input) tokens. */
  readonly promptCost: number;
  /** Cost incurred from completion (output) tokens. */
  readonly completionCost: number;
  /** Sum of `promptCost` and `completionCost`. */
  readonly totalCost: number;
  /** ISO 4217 currency code matching the source {@link CostRate}. */
  readonly currency: string;
}

/**
 * Computes the monetary cost for a single request given its token usage
 * and the provider's pricing {@link CostRate}.
 *
 * @param usage - Token breakdown for the request.
 * @param rate  - The pricing configuration for the provider.
 * @returns An immutable {@link RequestCost} value object.
 */
export function computeRequestCost(usage: TokenUsage, rate: CostRate): RequestCost {
  const promptCost = (usage.promptTokens / 1_000) * rate.promptCostPer1kTokens;
  const completionCost = (usage.completionTokens / 1_000) * rate.completionCostPer1kTokens;
  return Object.freeze({
    promptCost,
    completionCost,
    totalCost: promptCost + completionCost,
    currency: rate.currency,
  });
}
