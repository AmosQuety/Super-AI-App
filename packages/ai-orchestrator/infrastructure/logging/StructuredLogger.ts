import type { ILogger } from '../../core/ports/ILogger.js';
import type { LogEntry, LogLevel } from '../../core/logging/LogEntry.js';

/**
 * A caller-supplied function that receives each {@link LogEntry}.
 * Controls where log output is directed (e.g. `process.stdout.write`,
 * OpenTelemetry log exporter, Datadog agent, etc.).
 *
 * The sink MUST NOT throw — any exceptions are swallowed by the logger.
 */
export type LogSink = (entry: LogEntry) => void;

/**
 * Production-grade structured logger implementing {@link ILogger}.
 *
 * ## Design
 * - Writes `LogEntry` objects to an injected {@link LogSink} (not `console.*`).
 * - Each call builds an immutable entry and delegates to the sink.
 * - `child(correlationId)` returns a new instance pre-bound to the ID,
 *   so all downstream log calls carry it automatically.
 * - The sink is called inside a try/catch — logger never throws.
 *
 * ## Wiring example
 * ```ts
 * const logger = new StructuredLogger(
 *   (entry) => process.stdout.write(JSON.stringify(entry) + '\n'),
 *   { service: 'ai-orchestrator' },
 * );
 * const reqLogger = logger.child(crypto.randomUUID());
 * reqLogger.info('orchestrator.request.started', { model: 'gpt-4o' });
 * ```
 */
export class StructuredLogger implements ILogger {
  constructor(
    private readonly sink: LogSink,
    /** Static fields merged into every log entry produced by this instance. */
    private readonly baseContext: Readonly<Record<string, unknown>> = {},
    private readonly correlationId?: string,
  ) {}

  // ── ILogger ────────────────────────────────────────────────────────────────

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, undefined, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, undefined, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit('warn', message, undefined, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorContext: Record<string, unknown> = error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          // Capture stack only if present — omit in production if desired via sink filtering
          ...(error.stack ? { errorStack: error.stack } : {}),
        }
      : {};
    this.emit('error', message, undefined, { ...errorContext, ...context });
  }

  child(correlationId: string): ILogger {
    return new StructuredLogger(this.sink, this.baseContext, correlationId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private emit(
    level: LogLevel,
    message: string,
    _error: Error | undefined,
    context?: Record<string, unknown>,
  ): void {
    try {
      const entry: LogEntry = Object.freeze({
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(this.correlationId !== undefined ? { correlationId: this.correlationId } : {}),
        context: Object.freeze({
          ...this.baseContext,
          ...(context ?? {}),
        }),
      });
      this.sink(entry);
    } catch {
      // Logger must never throw — sink errors are suppressed silently
    }
  }
}
