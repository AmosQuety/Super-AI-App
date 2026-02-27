import type { ProviderTelemetrySnapshot } from '../telemetry/ProviderTelemetrySnapshot.js';
import type { RequestCost } from '../telemetry/RequestCost.js';
import type { TokenUsage } from '../entities/TokenUsage.js';

/**
 * Port — storage and query layer for accumulated telemetry metrics.
 *
 * Implementations accumulate per-provider metrics in whatever backend
 * is appropriate (in-memory, Redis, Prometheus, etc.).
 *
 * IMPORTANT: Implementations must never throw — failures are swallowed
 * to avoid disrupting the main execution path.
 */
export interface ITelemetryStore {
  /**
   * Records latency for a provider request.
   *
   * @param providerId - Provider that served the request.
   * @param durationMs - Elapsed time in milliseconds.
   */
  recordLatency(providerId: string, durationMs: number): void;

  /**
   * Records token consumption for a provider request.
   *
   * @param providerId - Provider that consumed the tokens.
   * @param usage      - Token breakdown.
   * @param cost       - Optional computed monetary cost.
   */
  recordUsage(providerId: string, usage: TokenUsage, cost?: RequestCost): void;

  /**
   * Increments the error counter for a provider.
   *
   * @param providerId - Provider that produced the error.
   */
  recordError(providerId: string): void;

  /**
   * Returns a snapshot of accumulated metrics for a specific provider.
   * Returns a zero-initialised snapshot if the provider has no data yet.
   */
  getSnapshot(providerId: string): ProviderTelemetrySnapshot;

  /**
   * Returns snapshots for all providers that have recorded metrics.
   * The returned array is immutable.
   */
  getAllSnapshots(): readonly ProviderTelemetrySnapshot[];
}
