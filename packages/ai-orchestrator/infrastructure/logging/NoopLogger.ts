import type { ILogger } from '../../core/ports/ILogger.js';

/**
 * Silent no-op implementation of {@link ILogger}.
 *
 * All log methods are empty. Designed for:
 * - Unit tests where log output is irrelevant
 * - Default wiring when callers do not provide a logger
 *
 * `child()` returns a new `NoopLogger` instance (also silent).
 */
export class NoopLogger implements ILogger {
  debug(_message: string, _context?: Record<string, unknown>): void { /* no-op */ }
  info(_message: string, _context?: Record<string, unknown>): void { /* no-op */ }
  warn(_message: string, _context?: Record<string, unknown>): void { /* no-op */ }
  error(_message: string, _error?: Error, _context?: Record<string, unknown>): void { /* no-op */ }

  child(_correlationId: string): ILogger {
    return new NoopLogger();
  }
}
