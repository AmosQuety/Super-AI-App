import type { ITelemetryStore } from '../../core/ports/ITelemetryStore.js';
import type { ProviderTelemetrySnapshot } from '../../core/telemetry/ProviderTelemetrySnapshot.js';
import type { RequestCost } from '../../core/telemetry/RequestCost.js';
import type { TokenUsage } from '../../core/entities/TokenUsage.js';

/** Mutable internal accumulator per provider. Not exposed externally. */
interface ProviderAccumulator {
  requestCount: number;
  totalLatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  currency: string;
  errorCount: number;
}

function makeZeroAccumulator(): ProviderAccumulator {
  return {
    requestCount: 0,
    totalLatencyMs: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCost: 0,
    currency: 'USD',
    errorCount: 0,
  };
}

/**
 * In-process, in-memory implementation of {@link ITelemetryStore}.
 *
 * All data is held in a Map keyed by provider ID. Data is lost when the
 * process exits — replace with a persistent adapter in production.
 *
 * Thread-safety: JavaScript is single-threaded; safe for any async use.
 *
 * `reset()` clears all accumulated data — useful for test isolation.
 */
export class InMemoryTelemetryStore implements ITelemetryStore {
  private readonly data = new Map<string, ProviderAccumulator>();

  // ── ITelemetryStore ────────────────────────────────────────────────────────

  recordLatency(providerId: string, durationMs: number): void {
    try {
      const acc = this.getOrCreate(providerId);
      acc.requestCount++;
      acc.totalLatencyMs += durationMs;
    } catch { /* never throw */ }
  }

  recordUsage(providerId: string, usage: TokenUsage, cost?: RequestCost): void {
    try {
      const acc = this.getOrCreate(providerId);
      acc.totalPromptTokens += usage.promptTokens;
      acc.totalCompletionTokens += usage.completionTokens;
      if (cost !== undefined) {
        acc.totalCost += cost.totalCost;
        acc.currency = cost.currency;
      }
    } catch { /* never throw */ }
  }

  recordError(providerId: string): void {
    try {
      const acc = this.getOrCreate(providerId);
      acc.errorCount++;
    } catch { /* never throw */ }
  }

  getSnapshot(providerId: string): ProviderTelemetrySnapshot {
    const acc = this.data.get(providerId) ?? makeZeroAccumulator();
    return this.toSnapshot(providerId, acc);
  }

  getAllSnapshots(): readonly ProviderTelemetrySnapshot[] {
    const snapshots: ProviderTelemetrySnapshot[] = [];
    for (const [providerId, acc] of this.data) {
      snapshots.push(this.toSnapshot(providerId, acc));
    }
    return Object.freeze(snapshots);
  }

  // ── Extra API ──────────────────────────────────────────────────────────────

  /**
   * Resets all accumulated data.
   * Intended for test isolation — clears all provider accumulators.
   */
  reset(): void {
    this.data.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getOrCreate(providerId: string): ProviderAccumulator {
    let acc = this.data.get(providerId);
    if (acc === undefined) {
      acc = makeZeroAccumulator();
      this.data.set(providerId, acc);
    }
    return acc;
  }

  private toSnapshot(
    providerId: string,
    acc: ProviderAccumulator,
  ): ProviderTelemetrySnapshot {
    return Object.freeze({
      providerId,
      requestCount: acc.requestCount,
      totalLatencyMs: acc.totalLatencyMs,
      avgLatencyMs: acc.requestCount > 0 ? acc.totalLatencyMs / acc.requestCount : 0,
      totalPromptTokens: acc.totalPromptTokens,
      totalCompletionTokens: acc.totalCompletionTokens,
      totalTokens: acc.totalPromptTokens + acc.totalCompletionTokens,
      totalCost: acc.totalCost,
      currency: acc.currency,
      errorCount: acc.errorCount,
    });
  }
}
