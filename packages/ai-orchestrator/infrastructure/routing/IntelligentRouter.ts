import type { IRouter } from '../../core/ports/IRouter.js';
import type { ICircuitBreaker } from '../../core/ports/ICircuitBreaker.js';
import type { IProvider } from '../../core/ports/IProvider.js';
import type { ChatMessage } from '../../core/entities/ChatMessage.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import type { ProviderMetrics } from '../../shared/types/ProviderMetrics.js';
import { createInitialMetrics } from '../../shared/types/ProviderMetrics.js';
import { RouterConfig } from './RouterConfig.js';
import { RouterError } from './RouterError.js';
import { ProviderScorer } from './ProviderScorer.js';

/** EMA smoothing factor α. Closer to 1 = more weight on recent observations. */
const EMA_ALPHA = 0.2;

/**
 * Implements {@link IRouter} with multi-factor scoring and adaptive metrics tracking.
 *
 * ## Routing logic
 * 1. **Manual override**: if `options.provider` is set, return that provider directly
 *    (circuit check still applies — throws {@link RouterError} if OPEN).
 * 2. **Score all candidates** via {@link ProviderScorer}:
 *    eliminate OPEN circuits, capability mismatches, and exhausted quotas.
 * 3. **Return the top scorer** (deterministic — no random selection).
 *
 * ## Metrics feedback
 * Call {@link recordSuccess} / {@link recordFailure} after each provider call so the
 * router can adaptively update latency EMA, error rate, and quota windows.
 * The {@link ChatOrchestrator} is responsible for calling these.
 */
export class IntelligentRouter implements IRouter {
  private readonly metrics: Map<string, ProviderMetrics>;
  private readonly scorer: ProviderScorer;

  constructor(
    private readonly config: RouterConfig,
    private readonly circuitBreaker: ICircuitBreaker,
  ) {
    this.scorer = new ProviderScorer();
    this.metrics = new Map();

    // Pre-initialise metrics for all configured entries
    for (const entry of config.entries) {
      this.metrics.set(
        entry.provider.id,
        createInitialMetrics(entry.quotaLimit),
      );
    }
  }

  // ── IRouter ────────────────────────────────────────────────────────────────

  async route(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<IProvider> {
    // 1. Manual override — caller pins a specific provider
    if (options.provider !== undefined) {
      return this.resolveOverride(options.provider, options);
    }

    // 2. Score remaining candidates
    const scored = this.scorer.score(
      this.config.entries,
      options,
      this.metrics,
      this.circuitBreaker,
      {
        costWeight: this.config.costWeight,
        latencyWeight: this.config.latencyWeight,
        errorRateWeight: this.config.errorRateWeight,
      },
    );

    if (scored.length === 0) {
      throw new RouterError(
        'All providers were eliminated (circuit open, quota exhausted, or capability mismatch).',
        this.config.entries.length,
      );
    }

    return scored[0].entry.provider;
  }

  // ── Metrics feedback API ───────────────────────────────────────────────────

  /**
   * Records a successful provider call and updates latency EMA.
   * Should be called by the orchestrator after every successful completion.
   */
  recordSuccess(providerId: string, latencyMs: number): void {
    const m = this.getOrCreateMetrics(providerId);
    this.updateQuotaWindow(m, providerId);

    m.latencyEmaMs =
      m.latencyEmaMs === Infinity
        ? latencyMs
        : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * m.latencyEmaMs;

    m.errorRate = EMA_ALPHA * 0 + (1 - EMA_ALPHA) * m.errorRate;
    m.quotaWindowCalls++;
    if (m.quotaRemaining !== Infinity) {
      m.quotaRemaining = Math.max(0, m.quotaRemaining - 1);
    }
    m.lastUpdatedAt = Date.now();
  }

  /**
   * Records a failed provider call and updates the error rate.
   * Should be called by the orchestrator after every failed completion.
   */
  recordFailure(providerId: string): void {
    const m = this.getOrCreateMetrics(providerId);
    m.errorRate = EMA_ALPHA * 1 + (1 - EMA_ALPHA) * m.errorRate;
    m.lastUpdatedAt = Date.now();
  }

  /**
   * Returns a read-only snapshot of current metrics for all providers.
   * Useful for observability and debugging.
   */
  getMetrics(): Map<string, Readonly<ProviderMetrics>> {
    return new Map(this.metrics);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Resolves a manually overridden provider ID.
   * Validates the provider exists in the configured entries and its circuit is not OPEN.
   */
  private resolveOverride(
    providerId: string,
    options: CompletionOptions,
  ): IProvider {
    const entry = this.config.entries.find((e) => e.provider.id === providerId);
    if (!entry) {
      throw new RouterError(
        `Manually overridden provider "${providerId}" is not registered.`,
        this.config.entries.length,
      );
    }

    const state = this.circuitBreaker.getState(providerId);
    if (state === 'OPEN') {
      throw new RouterError(
        `Manually overridden provider "${providerId}" has an OPEN circuit.`,
        1,
      );
    }

    // Still apply streaming capability check for explicit overrides
    if (options.stream === true && !entry.provider.capabilities.supportsStreaming) {
      throw new RouterError(
        `Provider "${providerId}" does not support streaming.`,
        1,
      );
    }

    return entry.provider;
  }

  private getOrCreateMetrics(providerId: string): ProviderMetrics {
    let m = this.metrics.get(providerId);
    if (!m) {
      m = createInitialMetrics(0);
      this.metrics.set(providerId, m);
    }
    return m;
  }

  /**
   * Resets the quota window if the window duration has elapsed.
   */
  private updateQuotaWindow(m: ProviderMetrics, providerId: string): void {
    const entry = this.config.entries.find((e) => e.provider.id === providerId);
    if (!entry || entry.quotaLimit === 0) return;

    const now = Date.now();
    if (now - m.quotaWindowStartMs >= entry.quotaWindowMs) {
      m.quotaRemaining = entry.quotaLimit;
      m.quotaWindowCalls = 0;
      m.quotaWindowStartMs = now;
    }
  }
}
