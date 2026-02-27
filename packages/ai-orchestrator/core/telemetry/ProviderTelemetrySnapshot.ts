/**
 * A point-in-time snapshot of accumulated telemetry for a single provider.
 * Returned by {@link ITelemetryStore.getSnapshot} and
 * {@link ITelemetryStore.getAllSnapshots}.
 */
export interface ProviderTelemetrySnapshot {
  /** The provider this snapshot belongs to. */
  readonly providerId: string;
  /** Total number of completion requests recorded. */
  readonly requestCount: number;
  /** Sum of all recorded latencies in milliseconds. */
  readonly totalLatencyMs: number;
  /** Average latency across all requests (0 when no requests). */
  readonly avgLatencyMs: number;
  /** Accumulated prompt token consumption. */
  readonly totalPromptTokens: number;
  /** Accumulated completion token consumption. */
  readonly totalCompletionTokens: number;
  /** Accumulated total tokens (prompt + completion). */
  readonly totalTokens: number;
  /** Accumulated monetary cost in the configured currency. */
  readonly totalCost: number;
  /** Currency code for `totalCost` (e.g. `'USD'`). */
  readonly currency: string;
  /** Total number of errors recorded for this provider. */
  readonly errorCount: number;
}
