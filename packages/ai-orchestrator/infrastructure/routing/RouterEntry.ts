import type { IProvider } from '../../core/ports/IProvider.js';

/**
 * Associates an {@link IProvider} with its routing metadata.
 * Configured once at startup and injected into {@link IntelligentRouter}.
 */
export interface RouterEntry {
  /** The provider adapter instance. */
  readonly provider: IProvider;

  /**
   * Relative cost weight. Lower values indicate a cheaper provider.
   * The scorer uses `1 / costFactor` as the cost contribution, so
   * a costFactor of 0.5 scores twice as well as costFactor of 1.0.
   * @default 1.0
   */
  readonly costFactor: number;

  /**
   * Tie-break priority added directly to the composite score.
   * Higher values are preferred when all other factors are equal.
   * @default 0
   */
  readonly priority: number;

  /**
   * Maximum number of requests permitted per {@link quotaWindowMs} window.
   * Set to 0 to disable quota enforcement for this entry.
   * @default 0 (unlimited)
   */
  readonly quotaLimit: number;

  /**
   * Duration of the quota measurement window in milliseconds.
   * @default 60_000 (1 minute)
   */
  readonly quotaWindowMs: number;
}

/** Creates a {@link RouterEntry} with sensible defaults. */
export function createRouterEntry(
  provider: IProvider,
  overrides?: Partial<Omit<RouterEntry, 'provider'>>,
): RouterEntry {
  return Object.freeze({
    provider,
    costFactor: 1.0,
    priority: 0,
    quotaLimit: 0,
    quotaWindowMs: 60_000,
    ...overrides,
  });
}
