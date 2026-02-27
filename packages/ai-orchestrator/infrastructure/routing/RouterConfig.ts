import type { RouterEntry } from './RouterEntry.js';

/**
 * Top-level configuration for {@link IntelligentRouter}.
 */
export interface RouterConfig {
  /**
   * All provider entries available for routing.
   * At least one entry must be present.
   */
  readonly entries: readonly RouterEntry[];

  /**
   * Ordered list of provider IDs to try when the primary provider fails.
   * Evaluated left-to-right; stop at the first successful provider.
   * If empty, no fallback is attempted (failure propagates immediately).
   */
  readonly failoverChain: readonly string[];

  /**
   * Scoring weight applied to the latency EMA component.
   * Must satisfy: latencyWeight + costWeight + errorRateWeight ≈ 1.
   * @default 0.3
   */
  readonly latencyWeight: number;

  /**
   * Scoring weight applied to the cost factor component.
   * @default 0.4
   */
  readonly costWeight: number;

  /**
   * Scoring weight applied to the error rate component.
   * @default 0.3
   */
  readonly errorRateWeight: number;
}

/** Creates a {@link RouterConfig} with production-safe default weights. */
export function createRouterConfig(
  entries: readonly RouterEntry[],
  overrides?: Partial<Omit<RouterConfig, 'entries'>>,
): RouterConfig {
  return Object.freeze({
    entries,
    failoverChain: [],
    latencyWeight: 0.3,
    costWeight: 0.4,
    errorRateWeight: 0.3,
    ...overrides,
  });
}
