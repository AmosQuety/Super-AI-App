/**
 * Supported log severity levels (ordered low → high).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A single structured log entry.
 * Immutable value object — serialise as JSON for any log sink.
 */
export interface LogEntry {
  /** Severity of the event. */
  readonly level: LogLevel;
  /** Human-readable message. Keep concise — put detail in `context`. */
  readonly message: string;
  /**
   * Correlation ID that links all log entries produced during a single
   * orchestration request. Populated when using {@link ILogger.child}.
   */
  readonly correlationId?: string;
  /**
   * Arbitrary structured key-value pairs for machine-readable context.
   * Values must be JSON-serialisable.
   */
  readonly context?: Readonly<Record<string, unknown>>;
  /** ISO-8601 timestamp (UTC) of when the entry was created. */
  readonly timestamp: string;
}
