import type { CircuitState } from '../../shared/types/CircuitState.js';

/**
 * Circuit breaker port — protects the system from cascading failures by
 * wrapping provider calls with failure-detection and fast-fail semantics.
 *
 * State machine:
 *   CLOSED → (failure threshold exceeded) → OPEN
 *   OPEN   → (cooldown elapsed)           → HALF_OPEN
 *   HALF_OPEN → (probe succeeds)          → CLOSED
 *   HALF_OPEN → (probe fails)             → OPEN
 *
 * Concrete implementations (e.g. Opossum, custom) are injected at runtime.
 */
export interface ICircuitBreaker {
  /**
   * Executes {@link fn} if the circuit for {@link providerId} is CLOSED or HALF_OPEN.
   * Throws {@link CircuitOpenError} if the circuit is OPEN.
   *
   * @param providerId - Provider identifier used to scope the circuit state.
   * @param fn         - The async operation to guard (typically a provider call).
   * @returns The result of {@link fn} on success.
   * @throws {CircuitOpenError} when the circuit is OPEN.
   * @throws Any error thrown by {@link fn} (which also trips the breaker).
   */
  execute<T>(providerId: string, fn: () => Promise<T>): Promise<T>;

  /**
   * Returns the current {@link CircuitState} for the given provider.
   *
   * @param providerId - Provider identifier to inspect.
   */
  getState(providerId: string): CircuitState;

  /**
   * Manually resets the circuit for the given provider to CLOSED.
   * Useful for administrative recovery after an outage.
   *
   * @param providerId - Provider identifier to reset.
   */
  reset(providerId: string): void;
}
