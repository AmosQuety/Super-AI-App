import type { RouterEntry } from './RouterEntry.js';
import type { ITelemetryStore } from '../../core/ports/ITelemetryStore.js';
import type { IPolicyEngine } from '../../core/ports/IPolicyEngine.js';
import type { ICostGuard } from '../../core/ports/ICostGuard.js';
import type { ILogger } from '../../core/ports/ILogger.js';
import { NoopLogger } from '../logging/NoopLogger.js';

export interface AdaptiveRouterConfig {
  /**
   * All provider entries available for routing.
   * At least one entry must be present.
   */
  readonly entries: readonly RouterEntry[];

  /**
   * Ordered list of provider IDs to try when the primary provider fails.
   */
  readonly failoverChain: readonly string[];

  /** Base latency weight. @default 0.3 */
  readonly latencyWeight: number;
  /** Base cost weight. @default 0.4 */
  readonly costWeight: number;
  /** Base error rate weight. @default 0.3 */
  readonly errorRateWeight: number;

  /**
   * Provides live operational metrics (latency EMA, error rate) to dynamically
   * adjust provider scoring beyond their base config.
   */
  readonly telemetryStore: ITelemetryStore;

  /**
   * Optional policy engine. Evaluated before scoring.
   * Can prevent requests (throwing) or override the provider choice.
   */
  readonly policyEngine?: IPolicyEngine;

  /**
   * Optional cost guard. Checked before routing to ensure the tenant
   * has sufficient budget.
   */
  readonly costGuard?: ICostGuard;

  readonly logger?: ILogger;
}

export function createAdaptiveRouterConfig(
  entries: readonly RouterEntry[],
  telemetryStore: ITelemetryStore,
  overrides?: Partial<Omit<AdaptiveRouterConfig, 'entries' | 'telemetryStore'>>,
): AdaptiveRouterConfig {
  return Object.freeze({
    entries,
    telemetryStore,
    failoverChain: [],
    latencyWeight: 0.3,
    costWeight: 0.4,
    errorRateWeight: 0.3,
    logger: new NoopLogger(),
    ...overrides,
  });
}
