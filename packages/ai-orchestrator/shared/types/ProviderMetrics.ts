/**
 * Runtime scoring data tracked per provider by the {@link IntelligentRouter}.
 * Values are updated after every completed or failed provider call.
 */
export interface ProviderMetrics {
  /**
   * Exponential moving average of successful response latency in milliseconds.
   * Initialised to `Infinity` until the first successful call is recorded.
   */
  latencyEmaMs: number;

  /**
   * Rolling error ratio over recent calls, in the range [0, 1].
   * 0 = no errors, 1 = all calls failed.
   */
  errorRate: number;

  /**
   * Remaining request budget within the current quota window.
   * `Infinity` if quota tracking is disabled for this provider.
   */
  quotaRemaining: number;

  /**
   * Total requests recorded in the current quota window.
   */
  quotaWindowCalls: number;

  /**
   * Unix timestamp (ms) when the current quota window started.
   */
  quotaWindowStartMs: number;

  /**
   * Unix timestamp (ms) of the last update to these metrics.
   */
  lastUpdatedAt: number;
}

/**
 * Creates a fresh {@link ProviderMetrics} instance for a newly registered provider.
 */
export function createInitialMetrics(quotaLimit: number): ProviderMetrics {
  return {
    latencyEmaMs: Infinity,
    errorRate: 0,
    quotaRemaining: quotaLimit === 0 ? Infinity : quotaLimit,
    quotaWindowCalls: 0,
    quotaWindowStartMs: Date.now(),
    lastUpdatedAt: Date.now(),
  };
}
