/**
 * OrchestratorFactory
 * ─────────────────────────────────────────────────────────────────────────────
 * Assembles the full ChatOrchestrator dependency graph and exports a
 * singleton instance. This file is the ONLY place in the backend where
 * orchestrator infrastructure classes are imported directly.
 *
 * Dependency order (bottom → top):
 *   GeminiProvider
 *     └─► ProviderRegistry
 *     └─► RouterEntry  ──► IntelligentRouter
 *   CircuitBreaker
 *   InMemoryTelemetryStore + WinstonLogger ──► TelemetryService
 *   ChatOrchestratorConfig
 *     └─► ChatOrchestrator  ← singleton export
 */

import {
  ChatOrchestrator,
  ProviderRegistry,
  CircuitBreaker,
  IntelligentRouter,
  InMemoryTelemetryStore,
  TelemetryService,
  createCircuitBreakerConfig,
  createRetryConfig,
  createRouterConfig,
  createRouterEntry,
  ContextBuilder,
  createContextBuilderConfig,
  OpenAIProvider,
} from '@super-ai/ai-orchestrator';
import type { ILogger } from '@super-ai/ai-orchestrator';
import { GeminiProvider } from './GeminiProvider';
import { PrismaMemoryStore } from './PrismaMemoryStore';
import { PrismaVectorStore } from './PrismaVectorStore';
import prisma from '../../lib/db';
import { logger, asyncContext } from '../../utils/logger';

// ── ILogger adapter ──────────────────────────────────────────────────────────

/**
 * Bridges the orchestrator's ILogger port to the existing Winston logger.
 * All methods are safe — they never throw.
 */
function getMetaWithRequestId(meta?: Record<string, unknown>) {
  const requestId = asyncContext.getStore()?.get('requestId');
  return { ...meta, ...(requestId && { requestId }) };
}

const winstonLoggerAdapter: ILogger = {
  debug(event: string, meta?: Record<string, unknown>): void {
    try { logger.debug(`[orchestrator] ${event}`, getMetaWithRequestId(meta)); } catch { /* noop */ }
  },
  info(event: string, meta?: Record<string, unknown>): void {
    try { logger.info(`[orchestrator] ${event}`, getMetaWithRequestId(meta)); } catch { /* noop */ }
  },
  warn(event: string, meta?: Record<string, unknown>): void {
    try { logger.warn(`[orchestrator] ${event}`, getMetaWithRequestId(meta)); } catch { /* noop */ }
  },
  error(event: string, err?: Error, meta?: Record<string, unknown>): void {
    try { logger.error(`[orchestrator] ${event}`, { ...getMetaWithRequestId(meta), error: err?.message, stack: err?.stack }); } catch { /* noop */ }
  },
  child(): ILogger {
    return this; 
  },
};

// ── Strategy Selection ────────────────────────────────────────────────────────

const STRATEGY = (process.env.PROVIDER_STRATEGY || 'gemini').toLowerCase();

// ── Providers & Registry ──────────────────────────────────────────────────────

const registry = new ProviderRegistry();

const geminiProvider = new GeminiProvider();
if (STRATEGY === 'gemini' || STRATEGY === 'multi') {
  registry.register(geminiProvider);
}

if (STRATEGY === 'openai' || STRATEGY === 'multi') {
  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    const openAIProvider = new OpenAIProvider({
      apiKey: openAIKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    });
    registry.register(openAIProvider);
  } else if (STRATEGY === 'openai') {
    logger.warn('[orchestrator] STRATEGY=openai requested but OPENAI_API_KEY is missing');
  }
}

// ── Circuit Breaker ──────────────────────────────────────────────────────────

const circuitBreakerConfig = createCircuitBreakerConfig({
  failureThreshold:  5,
  successThreshold:  2,
  cooldownMs:        30_000,
  halfOpenMaxCalls:  1,
});
const circuitBreaker = new CircuitBreaker(circuitBreakerConfig);

// ── Router ───────────────────────────────────────────────────────────────────

const routerEntries = [];

if (registry.has('gemini')) {
  routerEntries.push(
    createRouterEntry(geminiProvider, {
      costFactor:    0.5,   // Gemini Flash is cost-efficient
      priority:      10,    
      quotaLimit:    0,     
      quotaWindowMs: 60_000,
    })
  );
}

if (registry.has('openai')) {
  const openAIProvider = registry.get('openai')!;
  routerEntries.push(
    createRouterEntry(openAIProvider, {
      costFactor:    1.0,   // GPT-4o is standard cost
      priority:      STRATEGY === 'openai' ? 10 : 5,    // Lower priority if multi
      quotaLimit:    0,
      quotaWindowMs: 60_000,
    })
  );
}

const routerConfig = createRouterConfig(routerEntries, {
  failoverChain:    STRATEGY === 'multi' ? ['gemini', 'openai'] : [],
  latencyWeight:    0.3,
  costWeight:       0.4,
  errorRateWeight:  0.3,
});

const router = new IntelligentRouter(routerConfig, circuitBreaker);

// ── Telemetry ────────────────────────────────────────────────────────────────

const telemetryStore = new InMemoryTelemetryStore();

// Optional: define cost rates to automatically compute monetary cost of requests
const costRates = new Map([
  ['gemini', {
    providerId: 'gemini',
    promptCostPer1kTokens: 0.075 / 1000,     // e.g. gemini-1.5-flash prices
    completionCostPer1kTokens: 0.30 / 1000,
    currency: 'USD',
  }]
]);

const telemetry = new TelemetryService(telemetryStore, winstonLoggerAdapter, costRates);

// ── Context Pipeline & Memory ────────────────────────────────────────────────

const memoryStore = new PrismaMemoryStore(prisma);
const vectorStore = new PrismaVectorStore(prisma, geminiProvider);

const contextBuilderConfig = createContextBuilderConfig({
  maxDocumentChunks: 3, 
});

const contextBuilder = new ContextBuilder(
  memoryStore,
  registry.getAll(),
  contextBuilderConfig,
  vectorStore
);

// ── ChatOrchestrator (singleton) ─────────────────────────────────────────────

const orchestratorConfig = {
  fallbackProviderIds: [] as readonly string[],
  retryConfig: createRetryConfig({
    maxAttempts:  Number(process.env.ORCHESTRATOR_MAX_RETRIES ?? 3),
    baseDelayMs:  200,
    maxDelayMs:   10_000,
    jitterFactor: 0.2,
  }),
};

export const chatOrchestrator = new ChatOrchestrator(
  router,
  circuitBreaker,
  registry,
  telemetry,
  orchestratorConfig,
  contextBuilder,
  memoryStore,
  // toolLoop       — omitted: not needed for chat completion path
);

/** Expose the GeminiProvider directly for operations outside the orchestrator scope (e.g. embeddings). */
export { geminiProvider };

/** Expose the telemetry store for health/metrics endpoints. */
export { telemetryStore };

/** Expose the circuit breaker so it can be reset programmatically (e.g. from admin endpoints). */
export { circuitBreaker };

logger.info('[orchestrator] ChatOrchestrator singleton initialised', {
  strategy: STRATEGY,
  providers: Array.from(registry.getAll().values()).map((p: any) => p.id),
  circuitBreakerThreshold: circuitBreakerConfig.failureThreshold,
  retryMaxAttempts: orchestratorConfig.retryConfig.maxAttempts,
});
