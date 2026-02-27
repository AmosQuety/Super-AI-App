import type { TokenUsage } from '../entities/TokenUsage.js';

/**
 * Telemetry port — structured observability for the orchestration layer.
 *
 * Implementations emit metrics and events to any backend:
 *   - OpenTelemetry (recommended for production)
 *   - Prometheus / StatsD
 *   - Custom logging pipelines
 *
 * IMPORTANT: Implementations must never throw. All errors in recording
 * must be swallowed silently to avoid disrupting the main execution path.
 *
 * No console logging is permitted in implementations of this interface.
 */
export interface ITelemetry {
  /**
   * Records the end-to-end latency of a provider request.
   *
   * @param providerId  - The provider that served the request.
   * @param durationMs  - Elapsed time in milliseconds.
   */
  recordLatency(providerId: string, durationMs: number): void;

  /**
   * Records token consumption for billing and rate-limit tracking.
   *
   * @param providerId - The provider that consumed the tokens.
   * @param usage      - Token breakdown for this request.
   */
  recordTokenUsage(providerId: string, usage: TokenUsage): void;

  /**
   * Records a provider-side error for alerting and debugging.
   *
   * @param providerId - The provider that produced the error.
   * @param error      - The error that occurred.
   */
  recordError(providerId: string, error: Error): void;

  /**
   * Records a named domain event with optional structured metadata.
   *
   * @param event    - A stable, dot-namespaced event name
   *                   (e.g. "router.provider_selected", "circuit_breaker.opened").
   * @param metadata - Optional key-value context for the event.
   */
  recordEvent(event: string, metadata?: Readonly<Record<string, unknown>>): void;
}
