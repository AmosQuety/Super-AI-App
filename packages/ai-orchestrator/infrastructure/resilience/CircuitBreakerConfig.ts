/**
 * Configuration for a {@link CircuitBreaker} instance.
 * All values are immutable once constructed.
 */
export interface CircuitBreakerConfig {
  /**
   * Number of consecutive failures required to trip the circuit from CLOSED to OPEN.
   * @default 5
   */
  readonly failureThreshold: number;

  /**
   * Number of consecutive successes required in HALF_OPEN to transition back to CLOSED.
   * @default 2
   */
  readonly successThreshold: number;

  /**
   * Duration in milliseconds the circuit stays OPEN before transitioning to HALF_OPEN.
   * @default 30_000
   */
  readonly cooldownMs: number;

  /**
   * Maximum number of concurrent probe calls permitted in the HALF_OPEN state.
   * Additional calls while probes are in-flight receive a {@link CircuitOpenError}.
   * @default 1
   */
  readonly halfOpenMaxCalls: number;
}

/**
 * Returns a {@link CircuitBreakerConfig} with production-safe defaults
 * merged with any caller-supplied overrides.
 */
export function createCircuitBreakerConfig(
  overrides?: Partial<CircuitBreakerConfig>,
): CircuitBreakerConfig {
  return Object.freeze({
    failureThreshold: 5,
    successThreshold: 2,
    cooldownMs: 30_000,
    halfOpenMaxCalls: 1,
    ...overrides,
  });
}
