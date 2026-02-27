import type { ICircuitBreaker } from '../../core/ports/ICircuitBreaker.js';
import type { CircuitState } from '../../shared/types/CircuitState.js';
import {
  CircuitBreakerConfig,
  createCircuitBreakerConfig,
} from './CircuitBreakerConfig.js';
import {
  CircuitBreakerState,
  createInitialCircuitState,
} from './CircuitBreakerState.js';
import { CircuitOpenError } from './CircuitOpenError.js';

/**
 * Per-provider circuit breaker implementing the CLOSED / OPEN / HALF_OPEN
 * state machine without external library dependencies or background timers.
 *
 * State transitions are computed lazily at each {@link execute} call, using
 * wall-clock time to determine cooldown expiry.
 *
 * ## State Machine
 * ```
 * CLOSED ──(failures >= failureThreshold)──> OPEN
 * OPEN   ──(cooldownMs elapsed)───────────> HALF_OPEN
 * HALF_OPEN ──(success >= successThreshold)─> CLOSED
 * HALF_OPEN ──(any failure)────────────────> OPEN
 * ```
 */
export class CircuitBreaker implements ICircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly circuits: Map<string, CircuitBreakerState>;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = createCircuitBreakerConfig(config);
    this.circuits = new Map();
  }

  // ── ICircuitBreaker ────────────────────────────────────────────────────────

  /**
   * Executes {@link fn} through the circuit for {@link providerId}.
   *
   * - CLOSED: runs fn normally; failure trips toward open.
   * - OPEN: rejects immediately with {@link CircuitOpenError} unless cooldown elapsed.
   * - HALF_OPEN: allows up to {@link CircuitBreakerConfig.halfOpenMaxCalls} probe(s).
   */
  async execute<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getOrCreate(providerId);
    this.applyTimeBasedTransition(state);

    switch (state.state) {
      case 'OPEN':
        throw new CircuitOpenError(
          providerId,
          state.lastFailureTime + this.config.cooldownMs,
        );

      case 'HALF_OPEN':
        if (state.halfOpenCallsInFlight >= this.config.halfOpenMaxCalls) {
          throw new CircuitOpenError(
            providerId,
            state.lastFailureTime + this.config.cooldownMs,
          );
        }
        state.halfOpenCallsInFlight++;
        try {
          const result = await fn();
          this.onSuccess(state);
          return result;
        } catch (err) {
          this.onFailure(state);
          throw err;
        } finally {
          state.halfOpenCallsInFlight = Math.max(0, state.halfOpenCallsInFlight - 1);
        }

      case 'CLOSED':
      default:
        try {
          const result = await fn();
          this.onSuccess(state);
          return result;
        } catch (err) {
          this.onFailure(state);
          throw err;
        }
    }
  }

  /** Returns the current logical state for the given provider. */
  getState(providerId: string): CircuitState {
    const state = this.getOrCreate(providerId);
    this.applyTimeBasedTransition(state);
    return state.state;
  }

  /** Hard-resets the circuit for the given provider to CLOSED. */
  reset(providerId: string): void {
    this.circuits.set(providerId, createInitialCircuitState());
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getOrCreate(providerId: string): CircuitBreakerState {
    let state = this.circuits.get(providerId);
    if (!state) {
      state = createInitialCircuitState();
      this.circuits.set(providerId, state);
    }
    return state;
  }

  /**
   * Promotes OPEN → HALF_OPEN once the cooldown window has elapsed.
   * Called at the start of every {@link execute} and {@link getState} call.
   */
  private applyTimeBasedTransition(state: CircuitBreakerState): void {
    if (
      state.state === 'OPEN' &&
      Date.now() >= state.lastFailureTime + this.config.cooldownMs
    ) {
      state.state = 'HALF_OPEN';
      state.successCount = 0;
      state.halfOpenCallsInFlight = 0;
    }
  }

  private onSuccess(state: CircuitBreakerState): void {
    if (state.state === 'HALF_OPEN') {
      state.successCount++;
      if (state.successCount >= this.config.successThreshold) {
        state.state = 'CLOSED';
        state.failureCount = 0;
        state.successCount = 0;
      }
    } else {
      // CLOSED: reset failure streak on success
      state.failureCount = 0;
    }
  }

  private onFailure(state: CircuitBreakerState): void {
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (
      state.state === 'HALF_OPEN' ||
      state.failureCount >= this.config.failureThreshold
    ) {
      state.state = 'OPEN';
      state.successCount = 0;
    }
  }
}
