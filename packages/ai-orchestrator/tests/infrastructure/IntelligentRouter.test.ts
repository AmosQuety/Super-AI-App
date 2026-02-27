import { IntelligentRouter } from '../../infrastructure/routing/IntelligentRouter';
import { CircuitBreaker } from '../../infrastructure/resilience/CircuitBreaker';
import { RouterError } from '../../infrastructure/routing/RouterError';
import { createRouterEntry } from '../../infrastructure/routing/RouterEntry';
import { createRouterConfig } from '../../infrastructure/routing/RouterConfig';
import type { IProvider } from '../../core/ports/IProvider';
import type { ProviderCapabilities } from '../../core/entities/ProviderCapabilities';
import type { ChatMessage } from '../../core/entities/ChatMessage';
import type { CompletionOptions } from '../../core/entities/CompletionOptions';
import type { FinalResponse } from '../../core/entities/FinalResponse';
import type { StreamResponse } from '../../core/entities/StreamResponse';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeCapabilities(overrides?: Partial<ProviderCapabilities>): ProviderCapabilities {
  return {
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextTokens: 128_000,
    supportedModels: [],
    ...overrides,
  };
}

function makeProvider(id: string, caps?: Partial<ProviderCapabilities>): IProvider {
  return {
    id,
    capabilities: makeCapabilities(caps),
    complete: (_m: readonly ChatMessage[], _o: CompletionOptions): Promise<FinalResponse> =>
      Promise.reject(new Error('stub')),
    stream: (_m: readonly ChatMessage[], _o: CompletionOptions): AsyncIterable<StreamResponse> => {
      throw new Error('stub');
    },
    healthCheck: () => Promise.resolve(true),
  };
}

const MSG: readonly ChatMessage[] = [];
const OPTS: CompletionOptions = {};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IntelligentRouter', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 1 });
  });

  // ── Basic routing ──────────────────────────────────────────────────────────

  it('routes to the sole registered provider', async () => {
    const p = makeProvider('openai');
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p)]),
      cb,
    );
    await expect(router.route(MSG, OPTS)).resolves.toBe(p);
  });

  it('throws RouterError when no providers are registered', async () => {
    const router = new IntelligentRouter(createRouterConfig([]), cb);
    await expect(router.route(MSG, OPTS)).rejects.toThrow(RouterError);
  });

  // ── Manual override ────────────────────────────────────────────────────────

  it('returns the explicitly pinned provider via options.provider', async () => {
    const p1 = makeProvider('openai');
    const p2 = makeProvider('gemini');
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p1), createRouterEntry(p2)]),
      cb,
    );
    await expect(router.route(MSG, { provider: 'gemini' })).resolves.toBe(p2);
  });

  it('throws RouterError when overriding to an unregistered provider', async () => {
    const router = new IntelligentRouter(createRouterConfig([]), cb);
    await expect(router.route(MSG, { provider: 'ghost' })).rejects.toThrow(RouterError);
  });

  // ── Circuit-OPEN elimination ───────────────────────────────────────────────

  it('eliminates a provider whose circuit is OPEN', async () => {
    const p1 = makeProvider('openai');
    const p2 = makeProvider('gemini');

    // Trip p1's circuit
    await expect(cb.execute('openai', () => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState('openai')).toBe('OPEN');

    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p1), createRouterEntry(p2)]),
      cb,
    );
    await expect(router.route(MSG, OPTS)).resolves.toBe(p2);
  });

  it('throws RouterError when all providers have OPEN circuits', async () => {
    const p1 = makeProvider('openai');
    await expect(cb.execute('openai', () => Promise.reject(new Error('fail')))).rejects.toThrow();

    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p1)]),
      cb,
    );
    await expect(router.route(MSG, OPTS)).rejects.toThrow(RouterError);
  });

  // ── Capability elimination ─────────────────────────────────────────────────

  it('eliminates providers that do not support streaming when stream=true', async () => {
    const p1 = makeProvider('openai', { supportsStreaming: false });
    const p2 = makeProvider('gemini', { supportsStreaming: true });
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p1), createRouterEntry(p2)]),
      cb,
    );
    await expect(router.route(MSG, { stream: true })).resolves.toBe(p2);
  });

  it('eliminates providers whose supportedModels does not contain the requested model', async () => {
    const p1 = makeProvider('openai', { supportedModels: ['gpt-4'] });
    const p2 = makeProvider('gemini', { supportedModels: ['gemini-pro'] });
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p1), createRouterEntry(p2)]),
      cb,
    );
    await expect(router.route(MSG, { model: 'gemini-pro' })).resolves.toBe(p2);
  });

  it('accepts a provider with empty supportedModels for any model request', async () => {
    const p = makeProvider('openai', { supportedModels: [] });
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p)]),
      cb,
    );
    await expect(router.route(MSG, { model: 'any-model' })).resolves.toBe(p);
  });

  // ── Scoring — cost preference ──────────────────────────────────────────────

  it('prefers the lower-cost provider given equal latency and error rate', async () => {
    const cheap = makeProvider('cheap');
    const expensive = makeProvider('expensive');
    const router = new IntelligentRouter(
      createRouterConfig([
        createRouterEntry(cheap, { costFactor: 0.5 }),
        createRouterEntry(expensive, { costFactor: 2.0 }),
      ]),
      cb,
    );
    await expect(router.route(MSG, OPTS)).resolves.toBe(cheap);
  });

  // ── Metrics feedback ───────────────────────────────────────────────────────

  it('exposes a non-empty metrics map after construction', () => {
    const p = makeProvider('openai');
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p)]),
      cb,
    );
    expect(router.getMetrics().has('openai')).toBe(true);
  });

  it('updates latencyEmaMs after recordSuccess', () => {
    const p = makeProvider('openai');
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p)]),
      cb,
    );
    router.recordSuccess('openai', 200);
    const m = router.getMetrics().get('openai')!;
    expect(m.latencyEmaMs).toBe(200); // First observation = initialise to measured value
  });

  it('increases errorRate after recordFailure', () => {
    const p = makeProvider('openai');
    const router = new IntelligentRouter(
      createRouterConfig([createRouterEntry(p)]),
      cb,
    );
    router.recordFailure('openai');
    const m = router.getMetrics().get('openai')!;
    expect(m.errorRate).toBeGreaterThan(0);
  });
});
