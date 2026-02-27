import type { RetryConfig } from '../../infrastructure/resilience/RetryConfig.js';

/**
 * Configuration for {@link ChatOrchestrator}.
 */
export interface ChatOrchestratorConfig {
  /**
   * Ordered list of provider IDs to attempt when the primary provider
   * (selected by the router) fails or its circuit is OPEN.
   *
   * Providers are tried in order; the first success short-circuits the chain.
   * An empty array means no fallback — the orchestrator throws immediately.
   */
  readonly fallbackProviderIds: readonly string[];

  /**
   * Retry policy applied to each individual provider call.
   * Retries are attempted on the SAME provider before the fallback chain is invoked.
   *
   * For streaming calls, retry is disabled regardless of this config
   * because streaming responses cannot be safely replayed.
   */
  readonly retryConfig: RetryConfig;
}
