import { ChatOrchestrator } from '../../core/orchestration/ChatOrchestrator';
import { AllProvidersFailedError, NoRouteFoundError } from '../../core/orchestration/OrchestratorErrors';
import { ProviderRegistry } from '../../core/registry/ProviderRegistry';
import { CircuitBreaker } from '../../infrastructure/resilience/CircuitBreaker';
import { createRetryConfig } from '../../infrastructure/resilience/RetryConfig';
import { RouterError } from '../../infrastructure/routing/RouterError';
import type { IRouter } from '../../core/ports/IRouter';
import type { IProvider } from '../../core/ports/IProvider';
import type { ITelemetry } from '../../core/ports/ITelemetry';
import type { ChatMessage } from '../../core/entities/ChatMessage';
import type { CompletionOptions } from '../../core/entities/CompletionOptions';
import type { FinalResponse } from '../../core/entities/FinalResponse';
import type { StreamResponse } from '../../core/entities/StreamResponse';
import { createTokenUsage } from '../../core/entities/TokenUsage';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeNoopTelemetry(): ITelemetry {
  return {
    recordLatency: jest.fn(),
    recordTokenUsage: jest.fn(),
    recordError: jest.fn(),
    recordEvent: jest.fn(),
  };
}

function makeFinalResponse(overrides?: Partial<FinalResponse>): FinalResponse {
  return {
    id: 'resp-1',
    content: 'Hello!',
    model: 'test-model',
    provider: 'test-provider',
    usage: createTokenUsage(10, 20),
    finishReason: 'stop',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProvider(id: string, completeFn?: () => Promise<FinalResponse>): IProvider {
  return {
    id,
    capabilities: {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxContextTokens: 128_000,
      supportedModels: [],
    },
    complete: completeFn ?? (() => Promise.resolve(makeFinalResponse({ provider: id }))),
    stream: (_m, _o): AsyncIterable<StreamResponse> => { throw new Error('not implemented'); },
    healthCheck: () => Promise.resolve(true),
  };
}

function makeRouter(provider: IProvider): IRouter {
  return {
    route: jest.fn().mockResolvedValue(provider),
  };
}

function makeFailingRouter(error = new RouterError('no providers', 0)): IRouter {
  return {
    route: jest.fn().mockRejectedValue(error),
  };
}

const MSG: readonly ChatMessage[] = [];
const OPTS: CompletionOptions = {};
const NO_RETRY = createRetryConfig({ maxAttempts: 1, baseDelayMs: 0, jitterFactor: 0 });
const WITH_RETRY = createRetryConfig({ maxAttempts: 2, baseDelayMs: 0, jitterFactor: 0 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChatOrchestrator', () => {
  let registry: ProviderRegistry;
  let cb: CircuitBreaker;
  let telemetry: ITelemetry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    cb = new CircuitBreaker({ failureThreshold: 5 });
    telemetry = makeNoopTelemetry();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns FinalResponse on happy-path complete()', async () => {
    const provider = makeProvider('openai');
    const router = makeRouter(provider);
    registry.register(provider);

    const orchestrator = new ChatOrchestrator(router, cb, registry, telemetry, {
      fallbackProviderIds: [],
      retryConfig: NO_RETRY,
    });

    const response = await orchestrator.complete(MSG, OPTS);
    expect(response.provider).toBe('openai');
  });

  it('records telemetry on successful complete()', async () => {
    const provider = makeProvider('openai');
    const router = makeRouter(provider);
    registry.register(provider);

    const orchestrator = new ChatOrchestrator(router, cb, registry, telemetry, {
      fallbackProviderIds: [],
      retryConfig: NO_RETRY,
    });

    await orchestrator.complete(MSG, OPTS);
    expect(telemetry.recordLatency).toHaveBeenCalledWith('openai', expect.any(Number));
    expect(telemetry.recordTokenUsage).toHaveBeenCalled();
    expect(telemetry.recordEvent).toHaveBeenCalledWith('orchestrator.complete.success', expect.any(Object));
  });

  // ── Router failure ────────────────────────────────────────────────────────

  it('throws NoRouteFoundError when the router has no candidates', async () => {
    const orchestrator = new ChatOrchestrator(makeFailingRouter(), cb, registry, telemetry, {
      fallbackProviderIds: [],
      retryConfig: NO_RETRY,
    });
    await expect(orchestrator.complete(MSG, OPTS)).rejects.toThrow(NoRouteFoundError);
  });

  // ── Fallback chain ────────────────────────────────────────────────────────

  it('falls back to the second provider when the primary fails', async () => {
    const primary = makeProvider('primary', () => Promise.reject(new Error('primary failed')));
    const fallback = makeProvider('fallback');
    registry.register(primary);
    registry.register(fallback);

    const orchestrator = new ChatOrchestrator(makeRouter(primary), cb, registry, telemetry, {
      fallbackProviderIds: ['fallback'],
      retryConfig: NO_RETRY,
    });

    const response = await orchestrator.complete(MSG, OPTS);
    expect(response.provider).toBe('fallback');
  });

  it('throws AllProvidersFailedError when primary and all fallbacks fail', async () => {
    const primary = makeProvider('primary', () => Promise.reject(new Error('primary failed')));
    const fallback = makeProvider('fallback', () => Promise.reject(new Error('fallback failed')));
    registry.register(primary);
    registry.register(fallback);

    const orchestrator = new ChatOrchestrator(makeRouter(primary), cb, registry, telemetry, {
      fallbackProviderIds: ['fallback'],
      retryConfig: NO_RETRY,
    });

    await expect(orchestrator.complete(MSG, OPTS)).rejects.toThrow(AllProvidersFailedError);
  });

  it('AllProvidersFailedError includes attempted provider IDs', async () => {
    const primary = makeProvider('primary', () => Promise.reject(new Error('fail')));
    const fallback = makeProvider('fallback', () => Promise.reject(new Error('fail')));
    registry.register(primary);
    registry.register(fallback);

    const orchestrator = new ChatOrchestrator(makeRouter(primary), cb, registry, telemetry, {
      fallbackProviderIds: ['fallback'],
      retryConfig: NO_RETRY,
    });

    try {
      await orchestrator.complete(MSG, OPTS);
    } catch (e) {
      expect(e).toBeInstanceOf(AllProvidersFailedError);
      expect((e as AllProvidersFailedError).attemptedProviderIds).toEqual(['primary', 'fallback']);
    }
  });

  // ── Retry integration ─────────────────────────────────────────────────────

  it('succeeds on second attempt with retry config', async () => {
    let attempt = 0;
    const provider = makeProvider('openai', () => {
      attempt++;
      if (attempt < 2) return Promise.reject(new Error('transient'));
      return Promise.resolve(makeFinalResponse({ provider: 'openai' }));
    });
    registry.register(provider);

    const orchestrator = new ChatOrchestrator(makeRouter(provider), cb, registry, telemetry, {
      fallbackProviderIds: [],
      retryConfig: WITH_RETRY,
    });

    await expect(orchestrator.complete(MSG, OPTS)).resolves.toMatchObject({ provider: 'openai' });
    expect(attempt).toBe(2);
  });

  // ── Streaming ─────────────────────────────────────────────────────────────

  it('stream() resolves to an AsyncIterable of chunks', async () => {
    const chunks: StreamResponse[] = [
      { id: 's1', delta: 'Hello', model: 'test', provider: 'openai', isDone: false },
      { id: 's1', delta: '!', model: 'test', provider: 'openai', isDone: true, usage: createTokenUsage(5, 10) },
    ];

    async function* gen(): AsyncIterable<StreamResponse> {
      for (const c of chunks) yield c;
    }

    const provider: IProvider = { ...makeProvider('openai'), stream: () => gen() };
    registry.register(provider);

    const orchestrator = new ChatOrchestrator(makeRouter(provider), cb, registry, telemetry, {
      fallbackProviderIds: [],
      retryConfig: NO_RETRY,
    });

    const iterable = await orchestrator.stream(MSG, OPTS);
    const collected: StreamResponse[] = [];
    for await (const chunk of iterable) collected.push(chunk);

    expect(collected).toHaveLength(2);
    expect(collected[1].isDone).toBe(true);
    expect(telemetry.recordEvent).toHaveBeenCalledWith('orchestrator.stream.started', expect.any(Object));
    expect(telemetry.recordEvent).toHaveBeenCalledWith('orchestrator.stream.completed', expect.any(Object));
  });
});
