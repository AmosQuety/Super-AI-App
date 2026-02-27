import type { ITelemetry } from '../../core/ports/ITelemetry.js';
import type { ITelemetryStore } from '../../core/ports/ITelemetryStore.js';
import type { ILogger } from '../../core/ports/ILogger.js';
import type { TokenUsage } from '../../core/entities/TokenUsage.js';
import type { CostRate } from '../../core/telemetry/CostRate.js';
import { computeRequestCost } from '../../core/telemetry/RequestCost.js';

/**
 * Concrete implementation of {@link ITelemetry}.
 *
 * Combines three responsibilities:
 * 1. **Structured logging** — every telemetry event is logged via the
 *    injected {@link ILogger} at an appropriate level.
 * 2. **Metric storage** — latency, usage, and errors are forwarded to the
 *    {@link ITelemetryStore} for accumulation and querying.
 * 3. **Cost computation** — when `costRates` is provided, token usage
 *    events are used to compute and record monetary cost per request.
 *
 * ## Contract
 * - All methods swallow exceptions — this service must never disrupt
 *   the main orchestration path.
 * - No `console.*` calls — all output is via the injected logger's sink.
 *
 * ## Wiring example
 * ```ts
 * const telemetry = new TelemetryService(
 *   new InMemoryTelemetryStore(),
 *   logger.child(correlationId),
 *   new Map([
 *     ['openai', { providerId: 'openai', promptCostPer1kTokens: 0.03,
 *                  completionCostPer1kTokens: 0.06, currency: 'USD' }],
 *   ]),
 * );
 * ```
 */
export class TelemetryService implements ITelemetry {
  constructor(
    private readonly store: ITelemetryStore,
    private readonly logger: ILogger,
    private readonly costRates?: ReadonlyMap<string, CostRate>,
  ) {}

  // ── ITelemetry ─────────────────────────────────────────────────────────────

  recordLatency(providerId: string, durationMs: number): void {
    try {
      this.store.recordLatency(providerId, durationMs);
      this.logger.debug('provider.latency', { providerId, durationMs });
    } catch { /* never throw */ }
  }

  recordTokenUsage(providerId: string, usage: TokenUsage): void {
    try {
      const rate = this.costRates?.get(providerId);
      const cost = rate !== undefined ? computeRequestCost(usage, rate) : undefined;

      this.store.recordUsage(providerId, usage, cost);

      this.logger.info('provider.token_usage', {
        providerId,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        ...(cost !== undefined
          ? { totalCost: cost.totalCost, currency: cost.currency }
          : {}),
      });
    } catch { /* never throw */ }
  }

  recordError(providerId: string, error: Error): void {
    try {
      this.store.recordError(providerId);
      this.logger.error('provider.error', error, { providerId });
    } catch { /* never throw */ }
  }

  recordEvent(event: string, metadata?: Readonly<Record<string, unknown>>): void {
    try {
      this.logger.info(event, metadata as Record<string, unknown> | undefined);
    } catch { /* never throw */ }
  }
}
