import type { CircuitState } from '../../shared/types/CircuitState.js';

/**
 * Internal mutable state for a single provider's circuit.
 * Managed exclusively by {@link CircuitBreaker}; never exposed externally.
 */
export interface CircuitBreakerState {
  /** The current logical state of the circuit. */
  state: CircuitState;

  /** Consecutive failure count (resets on success in CLOSED/HALF_OPEN). */
  failureCount: number;

  /** Consecutive success count in HALF_OPEN (resets on any state change). */
  successCount: number;

  /**
   * Unix timestamp (ms) of the most recent failure.
   * Used to compute cooldown expiry for the OPEN → HALF_OPEN transition.
   */
  lastFailureTime: number;

  /**
   * Number of probe calls currently in-flight while in HALF_OPEN.
   * Guards against concurrent probes exceeding {@link CircuitBreakerConfig.halfOpenMaxCalls}.
   */
  halfOpenCallsInFlight: number;
}

/** Creates the default initial state for a circuit (CLOSED, no history). */
export function createInitialCircuitState(): CircuitBreakerState {
  return {
    state: 'CLOSED',
    failureCount: 0,
    successCount: 0,
    lastFailureTime: 0,
    halfOpenCallsInFlight: 0,
  };
}
