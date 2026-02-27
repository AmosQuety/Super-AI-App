/**
 * Thrown by {@link CircuitBreaker} when a provider's circuit is in the OPEN state
 * and the call is rejected without being attempted.
 */
export class CircuitOpenError extends Error {
  /** The provider ID whose circuit is open. */
  readonly providerId: string;
  /** Unix timestamp (ms) when the circuit is eligible to transition to HALF_OPEN. */
  readonly retryAfterMs: number;

  constructor(providerId: string, retryAfterMs: number) {
    super(
      `Circuit is OPEN for provider "${providerId}". ` +
      `Retry after ${new Date(retryAfterMs).toISOString()}.`,
    );
    this.name = 'CircuitOpenError';
    this.providerId = providerId;
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
