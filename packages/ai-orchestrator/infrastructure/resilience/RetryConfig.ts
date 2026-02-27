/**
 * Configuration for {@link RetryStrategy}.
 */
export interface RetryConfig {
  /**
   * Total number of attempts including the first try.
   * Setting this to 1 effectively disables retries.
   * @minimum 1
   */
  readonly maxAttempts: number;

  /**
   * Base delay in milliseconds before the first retry.
   * Each subsequent retry doubles this value (exponential backoff).
   * @default 200
   */
  readonly baseDelayMs: number;

  /**
   * Maximum delay cap in milliseconds.
   * Prevents backoff from growing unboundedly.
   * @default 10_000
   */
  readonly maxDelayMs: number;

  /**
   * Random jitter ratio applied to the computed delay, in [0, 1].
   * Final delay = computedDelay * (1 + jitterFactor * Math.random()).
   * Set to 0 to disable jitter.
   * @default 0.2
   */
  readonly jitterFactor: number;

  /**
   * Optional predicate that decides whether a given error should trigger a retry.
   * If omitted, all errors are retried up to {@link maxAttempts}.
   *
   * Return `false` to let the error propagate immediately without further retries
   * (e.g. for authentication errors or malformed request errors).
   */
  readonly retryableErrors?: (error: Error) => boolean;
}

/**
 * Returns a {@link RetryConfig} with conservative production defaults
 * merged with caller-supplied overrides.
 */
export function createRetryConfig(overrides?: Partial<RetryConfig>): RetryConfig {
  return Object.freeze({
    maxAttempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 10_000,
    jitterFactor: 0.2,
    ...overrides,
  });
}
