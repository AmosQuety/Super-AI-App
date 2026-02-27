import { TelemetryService } from '../../infrastructure/telemetry/TelemetryService';
import { InMemoryTelemetryStore } from '../../infrastructure/telemetry/InMemoryTelemetryStore';
import { NoopLogger } from '../../infrastructure/logging/NoopLogger';
import { StructuredLogger } from '../../infrastructure/logging/StructuredLogger';
import type { CostRate } from '../../core/telemetry/CostRate';
import { createTokenUsage } from '../../core/entities/TokenUsage';
import type { LogEntry } from '../../core/logging/LogEntry';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TelemetryService', () => {
  let store: InMemoryTelemetryStore;
  let telemetry: TelemetryService;

  const costRates: ReadonlyMap<string, CostRate> = new Map([
    ['openai', { providerId: 'openai', promptCostPer1kTokens: 0.03, completionCostPer1kTokens: 0.06, currency: 'USD' }],
  ]);

  beforeEach(() => {
    store = new InMemoryTelemetryStore();
    telemetry = new TelemetryService(store, new NoopLogger(), costRates);
  });

  // ── recordLatency ──────────────────────────────────────────────────────────

  it('recordLatency increments requestCount and accumulates totalLatencyMs', () => {
    telemetry.recordLatency('openai', 120);
    telemetry.recordLatency('openai', 80);

    const snap = store.getSnapshot('openai');
    expect(snap.requestCount).toBe(2);
    expect(snap.totalLatencyMs).toBe(200);
    expect(snap.avgLatencyMs).toBe(100);
  });

  it('recordLatency never throws even with unusual values', () => {
    expect(() => telemetry.recordLatency('unknown', -5)).not.toThrow();
    expect(() => telemetry.recordLatency('', NaN)).not.toThrow();
  });

  // ── recordTokenUsage ───────────────────────────────────────────────────────

  it('recordTokenUsage accumulates token counts', () => {
    telemetry.recordTokenUsage('openai', createTokenUsage(100, 200));
    telemetry.recordTokenUsage('openai', createTokenUsage(50, 100));

    const snap = store.getSnapshot('openai');
    expect(snap.totalPromptTokens).toBe(150);
    expect(snap.totalCompletionTokens).toBe(300);
    expect(snap.totalTokens).toBe(450);
  });

  it('recordTokenUsage computes cost when rate is configured', () => {
    // 1000 prompt tokens × 0.03/1k = 0.03
    // 2000 completion tokens × 0.06/1k = 0.12
    // total = 0.15
    telemetry.recordTokenUsage('openai', createTokenUsage(1_000, 2_000));

    const snap = store.getSnapshot('openai');
    expect(snap.totalCost).toBeCloseTo(0.15, 5);
    expect(snap.currency).toBe('USD');
  });

  it('recordTokenUsage records zero cost when no rate is configured', () => {
    telemetry.recordTokenUsage('gemini', createTokenUsage(1_000, 1_000));
    const snap = store.getSnapshot('gemini');
    // No cost rate for 'gemini' — totalCost stays 0
    expect(snap.totalCost).toBe(0);
  });

  it('recordTokenUsage accumulates cost across multiple calls', () => {
    telemetry.recordTokenUsage('openai', createTokenUsage(1_000, 1_000));
    telemetry.recordTokenUsage('openai', createTokenUsage(1_000, 1_000));

    const snap = store.getSnapshot('openai');
    // Each call: 0.03 + 0.06 = 0.09. Two calls = 0.18
    expect(snap.totalCost).toBeCloseTo(0.18, 5);
  });

  // ── recordError ────────────────────────────────────────────────────────────

  it('recordError increments errorCount', () => {
    telemetry.recordError('openai', new Error('timeout'));
    telemetry.recordError('openai', new Error('rate limit'));

    expect(store.getSnapshot('openai').errorCount).toBe(2);
  });

  it('recordError never throws', () => {
    expect(() => telemetry.recordError('', new Error('x'))).not.toThrow();
  });

  // ── recordEvent ────────────────────────────────────────────────────────────

  it('recordEvent never throws', () => {
    expect(() => telemetry.recordEvent('orchestrator.complete.success', { model: 'gpt-4o' })).not.toThrow();
    expect(() => telemetry.recordEvent('routing.selected')).not.toThrow();
  });

  // ── InMemoryTelemetryStore.getAllSnapshots ─────────────────────────────────

  it('getAllSnapshots returns entries for all providers that have data', () => {
    telemetry.recordLatency('openai', 100);
    telemetry.recordLatency('gemini', 200);

    const all = store.getAllSnapshots();
    expect(all.length).toBe(2);
    const ids = all.map((s) => s.providerId);
    expect(ids).toContain('openai');
    expect(ids).toContain('gemini');
  });

  it('getAllSnapshots is immutable', () => {
    telemetry.recordLatency('openai', 100);
    const all = store.getAllSnapshots();
    expect(Object.isFrozen(all)).toBe(true);
  });

  it('getSnapshot returns zero-initialised snapshot for unknown provider', () => {
    const snap = store.getSnapshot('nonexistent');
    expect(snap.requestCount).toBe(0);
    expect(snap.totalCost).toBe(0);
    expect(snap.errorCount).toBe(0);
  });

  it('reset() clears all data', () => {
    telemetry.recordLatency('openai', 100);
    store.reset();
    expect(store.getAllSnapshots()).toHaveLength(0);
    expect(store.getSnapshot('openai').requestCount).toBe(0);
  });
});

// ── StructuredLogger tests ────────────────────────────────────────────────────

describe('StructuredLogger', () => {
  function makeLogger() {
    const captured: LogEntry[] = [];
    const logger = new StructuredLogger((entry) => captured.push(entry));
    return { logger, captured };
  }

  it('info() emits an entry with level=info and the correct message', () => {
    const { logger, captured } = makeLogger();
    logger.info('test.message', { foo: 'bar' });

    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe('info');
    expect(captured[0].message).toBe('test.message');
    expect(captured[0].context).toMatchObject({ foo: 'bar' });
  });

  it('error() includes errorName and errorMessage in context', () => {
    const { logger, captured } = makeLogger();
    logger.error('something.failed', new TypeError('bad input'));

    expect(captured[0].level).toBe('error');
    expect(captured[0].context).toMatchObject({ errorName: 'TypeError', errorMessage: 'bad input' });
  });

  it('child() scopes the correlationId to all emitted entries', () => {
    const { logger, captured } = makeLogger();
    const scoped = logger.child('corr-123');

    scoped.debug('scoped.debug');
    scoped.info('scoped.info');

    expect(captured).toHaveLength(2);
    expect(captured[0].correlationId).toBe('corr-123');
    expect(captured[1].correlationId).toBe('corr-123');
  });

  it('parent logger does not inherit child correlationId', () => {
    const { logger, captured } = makeLogger();
    logger.child('corr-abc');
    logger.info('parent.event');

    // Parent entry should have no correlationId
    expect(captured[0].correlationId).toBeUndefined();
  });

  it('baseContext is merged into every entry', () => {
    const captured: LogEntry[] = [];
    const logger = new StructuredLogger((e) => captured.push(e), { service: 'ai-orchestrator' });
    logger.warn('some.warning');

    expect(captured[0].context).toMatchObject({ service: 'ai-orchestrator' });
  });

  it('never throws when the sink throws', () => {
    const logger = new StructuredLogger(() => { throw new Error('sink exploded'); });
    expect(() => logger.info('test')).not.toThrow();
  });

  it('entries carry an ISO-8601 timestamp', () => {
    const { logger, captured } = makeLogger();
    logger.info('ts.test');
    expect(new Date(captured[0].timestamp).toISOString()).toBe(captured[0].timestamp);
  });

  it('NoopLogger produces no entries and never throws', () => {
    const { NoopLogger: Noop } = require('../../infrastructure/logging/NoopLogger');
    const noop = new Noop();
    expect(() => {
      noop.debug('x');
      noop.info('x');
      noop.warn('x');
      noop.error('x', new Error());
      noop.child('id').info('y');
    }).not.toThrow();
  });
});
