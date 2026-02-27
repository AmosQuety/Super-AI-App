import type { ICircuitBreaker } from '../../core/ports/ICircuitBreaker.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import type { ProviderMetrics } from '../../shared/types/ProviderMetrics.js';
import type { RouterEntry } from './RouterEntry.js';
import type { RouterConfig } from './RouterConfig.js';

/** A candidate entry with its computed composite score. */
export interface ScoredEntry {
  readonly entry: RouterEntry;
  readonly score: number;
}

/**
 * Stateless scoring engine used by {@link IntelligentRouter}.
 *
 * ## Elimination rules (in order — a single failing rule eliminates the provider)
 * 1. Circuit for this provider is OPEN → eliminated
 * 2. `options.stream === true` but provider does not support streaming → eliminated
 * 3. A specific model is requested and the provider's `supportedModels`
 *    is non-empty and does not contain that model → eliminated
 * 4. `quotaRemaining` is exhausted (0) → eliminated
 *
 * ## Composite score (higher = better)
 * ```
 * score =
 *   (1 / costFactor)         * costWeight        +
 *   (1 / latencyEmaMs)       * latencyWeight      +  ← Infinity latency → 0 contribution
 *   (1 - errorRate)          * errorRateWeight     +
 *   priority
 * ```
 */
export class ProviderScorer {
  /**
   * Filters and ranks {@link entries} for the given completion options.
   *
   * @param entries         - Full set of router entries to evaluate.
   * @param options         - Completion options constraining provider selection.
   * @param metricsMap      - Runtime metrics keyed by provider ID.
   * @param circuitBreaker  - Used to check per-provider circuit state.
   * @param config          - Scoring weights from the router config.
   * @returns Eligible entries sorted by descending composite score.
   */
  score(
    entries: readonly RouterEntry[],
    options: CompletionOptions,
    metricsMap: ReadonlyMap<string, ProviderMetrics>,
    circuitBreaker: ICircuitBreaker,
    config: Pick<RouterConfig, 'costWeight' | 'latencyWeight' | 'errorRateWeight'>,
  ): ScoredEntry[] {
    const candidates: ScoredEntry[] = [];

    for (const entry of entries) {
      const { provider } = entry;
      const metrics = metricsMap.get(provider.id);

      // 1. Circuit state elimination
      if (circuitBreaker.getState(provider.id) === 'OPEN') {
        continue;
      }

      // 2. Streaming capability check
      if (options.stream === true && !provider.capabilities.supportsStreaming) {
        continue;
      }

      // 3. Model compatibility check
      const { supportedModels } = provider.capabilities;
      if (
        options.model !== undefined &&
        supportedModels.length > 0 &&
        !supportedModels.includes(options.model)
      ) {
        continue;
      }

      // 4. Quota exhaustion check
      if (metrics !== undefined && metrics.quotaRemaining === 0) {
        continue;
      }

      // Composite scoring
      const latencyEma = metrics?.latencyEmaMs ?? Infinity;
      const errorRate = metrics?.errorRate ?? 0;

      const costContribution = (1 / entry.costFactor) * config.costWeight;
      const latencyContribution =
        latencyEma === Infinity
          ? 0
          : (1 / latencyEma) * config.latencyWeight;
      const errorContribution = (1 - errorRate) * config.errorRateWeight;

      const score =
        costContribution + latencyContribution + errorContribution + entry.priority;

      candidates.push({ entry, score });
    }

    // Sort descending — highest score wins
    return candidates.sort((a, b) => b.score - a.score);
  }
}
