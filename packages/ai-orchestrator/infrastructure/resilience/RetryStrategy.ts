import { RetryConfig } from './RetryConfig.js';

/**
 * Stateless exponential-backoff retry utility.
 *
 * Not a port implementation — this is a pure infrastructure helper consumed
 * by {@link ChatOrchestrator} to wrap provider calls.
 *
 * ## Backoff formula
 * ```
 * delay = min(baseDelayMs * 2^attempt, maxDelayMs) * (1 + jitterFactor * rand)
 * ```
 * where `attempt` is zero-indexed (0 for the first retry after initial failure).
 */
export class RetryStrategy {
  /**
   * Executes {@link fn} with retry semantics defined by {@link config}.
   *
   * @param fn     - The async operation to attempt.
   * @param config - Retry policy to apply.
   * @returns The result of the first successful attempt.
   * @throws The last error encountered after all attempts are exhausted,
   *         or the first non-retryable error immediately.
   */
  async execute<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
    let lastError: Error = new Error('RetryStrategy: no attempts made');

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const isRetryable = config.retryableErrors
          ? config.retryableErrors(lastError)
          : true;

        if (!isRetryable) {
          throw lastError;
        }

        const isLastAttempt = attempt === config.maxAttempts - 1;
        if (isLastAttempt) {
          break;
        }

        await this.delay(this.computeDelay(attempt, config));
      }
    }

    throw lastError;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Computes the backoff delay for a given retry attempt index (0-based).
   */
  private computeDelay(attempt: number, config: RetryConfig): number {
    const exponential = config.baseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, config.maxDelayMs);
    const jitter = 1 + config.jitterFactor * Math.random();
    return Math.round(capped * jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
