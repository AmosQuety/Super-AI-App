/**
 * The possible states of a circuit breaker for a given provider.
 *
 * ```
 * CLOSED    — Normal operation. Requests pass through.
 * OPEN      — Failure threshold exceeded. Requests fail immediately (fast-fail).
 * HALF_OPEN — Cooldown elapsed. A probe request is allowed through to test recovery.
 * ```
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
