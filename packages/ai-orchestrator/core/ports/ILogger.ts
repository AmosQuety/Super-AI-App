/**
 * Logging port — the boundary between the core layer and any concrete
 * log sink (file, stdout, OpenTelemetry, Datadog, etc.).
 *
 * ## Contract
 * - Implementations MUST NOT throw under any circumstances.
 * - Implementations MUST NOT use `console.*` directly; they must write
 *   to an injected sink so callers control the output channel.
 * - The `child()` method returns a new logger pre-bound to a correlationId,
 *   enabling per-request tracing without manual propagation.
 *
 * ## Usage
 * ```ts
 * const reqLogger = logger.child(correlationId);
 * reqLogger.info('routing.started', { candidateCount: 3 });
 * reqLogger.error('provider.failed', err, { providerId: 'openai' });
 * ```
 */
export interface ILogger {
  /**
   * Low-level diagnostic information. Disabled in production by default.
   *
   * @param message - Short description of the event.
   * @param context - Optional structured key-value pairs.
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Noteworthy operational events (routing decisions, circuit state changes).
   *
   * @param message - Short description of the event.
   * @param context - Optional structured key-value pairs.
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Non-fatal issues that warrant attention (retries, degraded fallbacks).
   *
   * @param message - Short description of the concern.
   * @param context - Optional structured key-value pairs.
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Errors that disrupted a request or sub-system.
   *
   * @param message - Short description of the failure.
   * @param error   - The caught Error instance (name + message + stack captured).
   * @param context - Optional structured key-value pairs.
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void;

  /**
   * Returns a child logger scoped to the provided `correlationId`.
   * All entries emitted by the child carry that ID, enabling per-request
   * log aggregation without manual propagation.
   *
   * @param correlationId - Unique identifier for this request/session.
   */
  child(correlationId: string): ILogger;
}
