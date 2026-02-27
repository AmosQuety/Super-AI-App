/**
 * Per-provider pricing rates used to compute request cost at recording time.
 *
 * All costs are expressed in the specified `currency` per 1,000 tokens.
 */
export interface CostRate {
  /** Must match the provider's `IProvider.id`. */
  readonly providerId: string;
  /** Cost in `currency` units per 1,000 prompt tokens. */
  readonly promptCostPer1kTokens: number;
  /** Cost in `currency` units per 1,000 completion tokens. */
  readonly completionCostPer1kTokens: number;
  /** ISO 4217 currency code, e.g. `'USD'`. */
  readonly currency: string;
}
