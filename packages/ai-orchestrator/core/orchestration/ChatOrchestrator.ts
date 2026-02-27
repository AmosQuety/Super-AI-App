import type { IRouter } from '../ports/IRouter.js';
import type { ICircuitBreaker } from '../ports/ICircuitBreaker.js';
import type { ITelemetry } from '../ports/ITelemetry.js';
import type { IProvider } from '../ports/IProvider.js';
import type { IContextBuilder } from '../ports/IContextBuilder.js';
import type { IMemoryStore } from '../ports/IMemoryStore.js';
import type { ChatMessage } from '../entities/ChatMessage.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';
import type { FinalResponse } from '../entities/FinalResponse.js';
import type { StreamResponse } from '../entities/StreamResponse.js';
import type { ToolLoop } from '../tools/ToolLoop.js';
import { ProviderRegistry } from '../registry/ProviderRegistry.js';
import { RetryStrategy } from '../../infrastructure/resilience/RetryStrategy.js';
import { CircuitOpenError } from '../../infrastructure/resilience/CircuitOpenError.js';
import { ChatOrchestratorConfig } from './ChatOrchestratorConfig.js';
import { AllProvidersFailedError, NoRouteFoundError } from './OrchestratorErrors.js';

/**
 * Core use-case class — the entry point for all AI completion requests.
 *
 * ## complete() dispatch loop
 * ```
 * 1. contextBuilder.build()   → assemble context-aware message list (optional)
 * 2. router.route()           → select primary provider
 * 3. retryStrategy.execute()  → per-provider retry with backoff
 *    └─ circuitBreaker.execute() → fast-fail or probe
 *       └─ provider.complete()   → actual API call
 * 4. On failure               → iterate fallbackProviderIds (same pattern)
 * 5. On success               → persist messages to memoryStore (optional)
 * 6. Exhausted                → throw AllProvidersFailedError
 * ```
 *
 * ## stream() dispatch loop
 * Same routing and context pipeline, but calls `provider.stream()`.
 * Retry is intentionally disabled for streaming.
 *
 * ## Context pipeline (optional)
 * When `contextBuilder` is injected, the raw messages argument is replaced
 * by the context-built list. When `memoryStore` is injected, the user message
 * and assistant reply are persisted after each successful call.
 *
 * Both `contextBuilder` and `memoryStore` are optional. When absent, the
 * orchestrator behaves exactly as Phase 2 — fully backwards-compatible.
 *
 * ## Dependency Inversion
 * This class depends only on core ports and the {@link ProviderRegistry}.
 * No concrete infrastructure class is imported here.
 */
export class ChatOrchestrator {
  private readonly retryStrategy: RetryStrategy;

  constructor(
    private readonly router: IRouter,
    private readonly circuitBreaker: ICircuitBreaker,
    private readonly registry: ProviderRegistry,
    private readonly telemetry: ITelemetry,
    private readonly config: ChatOrchestratorConfig,
    /** Optional context pipeline: builds token-budget-aware message lists. */
    private readonly contextBuilder?: IContextBuilder,
    /** Optional memory store: persists messages after each successful call. */
    private readonly memoryStore?: IMemoryStore,
    /**
     * Optional agentic tool loop.
     * When injected and `options.tools` is non-empty, `complete()` is routed
     * through {@link ToolLoop.run} to enable multi-step tool execution.
     * Has no effect on the streaming path.
     */
    private readonly toolLoop?: ToolLoop,
  ) {
    this.retryStrategy = new RetryStrategy();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Sends a completion request and returns the full, resolved response.
   *
   * @param messages - Ordered message history to dispatch.
   * @param options  - Completion configuration.
   * @throws {NoRouteFoundError} if the router cannot select any provider.
   * @throws {AllProvidersFailedError} if every provider in the chain fails.
   */
  async complete(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<FinalResponse> {
    // Resolve the user message (last message) and session
    const userMessage = messages[messages.length - 1];
    const sessionId = options.sessionId;

    // --- Context pipeline (optional) ---
    let contextMessages: readonly ChatMessage[] = messages;
    if (this.contextBuilder !== undefined && userMessage !== undefined && sessionId !== undefined) {
      contextMessages = await this.contextBuilder.build(sessionId, userMessage, options);
    }

    // --- Tool loop (optional) ---
    // When a ToolLoop is configured AND the caller passed tools, delegate the
    // entire provider interaction through the loop. The loop handles provider
    // selection internally (it always uses the injected primary provider).
    if (this.toolLoop !== undefined && options.tools !== undefined && options.tools.length > 0) {
      const { response, trace } = await this.toolLoop.run(contextMessages, options);

      this.telemetry.recordTokenUsage(response.provider, response.usage);
      this.telemetry.recordEvent('orchestrator.toolloop.completed', {
        totalSteps: trace.totalSteps,
        providerId: response.provider,
        sessionId,
      });

      // Persist final response to memory (optional)
      if (this.memoryStore !== undefined && sessionId !== undefined && userMessage !== undefined) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.content,
          createdAt: new Date().toISOString(),
        };
        void this.persistMessages(sessionId, userMessage, assistantMessage);
      }

      return response;
    }

    const primaryProvider = await this.routeOrThrow(contextMessages, options);
    const chain = this.buildChain(primaryProvider, options);

    let lastError: Error = new Error('No attempt was made');
    const attempted: string[] = [];

    for (const provider of chain) {
      attempted.push(provider.id);
      const startMs = Date.now();

      try {
        const response = await this.retryStrategy.execute(
          () => this.circuitBreaker.execute(
            provider.id,
            () => provider.complete(contextMessages, options),
          ),
          this.config.retryConfig,
        );

        this.telemetry.recordLatency(provider.id, Date.now() - startMs);
        this.telemetry.recordTokenUsage(provider.id, response.usage);
        this.telemetry.recordEvent('orchestrator.complete.success', {
          providerId: provider.id,
          model: response.model,
          sessionId,
        });

        // --- Memory persistence (optional) ---
        if (this.memoryStore !== undefined && sessionId !== undefined && userMessage !== undefined) {
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.content,
            createdAt: new Date().toISOString(),
          };
          // Fire-and-forget — memory errors must not disrupt the response
          void this.persistMessages(sessionId, userMessage, assistantMessage);
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.telemetry.recordError(provider.id, lastError);
        this.telemetry.recordEvent('orchestrator.complete.failure', {
          providerId: provider.id,
          errorName: lastError.name,
          sessionId,
        });
      }
    }

    throw new AllProvidersFailedError(attempted, lastError);
  }

  /**
   * Initiates a streaming completion and returns an async iterable of chunks.
   *
   * No retry is applied — streaming responses cannot be safely replayed.
   * The context pipeline IS applied (context building is not tied to streaming).
   *
   * @param messages - Ordered message history to dispatch.
   * @param options  - Completion configuration.
   * @throws {NoRouteFoundError} if the router cannot select a streaming-capable provider.
   * @throws {AllProvidersFailedError} if all providers in the chain fail.
   */
  async stream(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<AsyncIterable<StreamResponse>> {
    const streamOptions: CompletionOptions = { ...options, stream: true };
    const userMessage = messages[messages.length - 1];
    const sessionId = streamOptions.sessionId;

    // --- Context pipeline (optional) ---
    let contextMessages: readonly ChatMessage[] = messages;
    if (this.contextBuilder !== undefined && userMessage !== undefined && sessionId !== undefined) {
      contextMessages = await this.contextBuilder.build(sessionId, userMessage, streamOptions);
    }

    const primaryProvider = await this.routeOrThrow(contextMessages, streamOptions);
    const chain = this.buildChain(primaryProvider, streamOptions);

    let lastError: Error = new Error('No stream attempt was made');
    const attempted: string[] = [];

    for (const provider of chain) {
      attempted.push(provider.id);

      try {
        const iterable = await this.circuitBreaker.execute(
          provider.id,
          () => Promise.resolve(provider.stream(contextMessages, streamOptions)),
        );

        this.telemetry.recordEvent('orchestrator.stream.started', {
          providerId: provider.id,
          sessionId,
        });

        return this.wrapStream(provider.id, iterable, sessionId, userMessage);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof CircuitOpenError) {
          continue;
        }

        this.telemetry.recordError(provider.id, lastError);
        throw lastError;
      }
    }

    throw new AllProvidersFailedError(attempted, lastError);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async routeOrThrow(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<IProvider> {
    try {
      return await this.router.route(messages, options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new NoRouteFoundError(msg);
    }
  }

  private buildChain(
    primary: IProvider,
    options: CompletionOptions,
  ): IProvider[] {
    const chain: IProvider[] = [primary];

    for (const id of this.config.fallbackProviderIds) {
      if (id === primary.id) continue;

      try {
        const fallback = this.registry.get(id);
        if (options.stream === true && !fallback.capabilities.supportsStreaming) {
          continue;
        }
        chain.push(fallback);
      } catch {
        // Unregistered fallback — skip silently
      }
    }

    return chain;
  }

  /** Persists user + assistant messages to the memory store. Errors are suppressed. */
  private async persistMessages(
    sessionId: string,
    userMessage: ChatMessage,
    assistantMessage: ChatMessage,
  ): Promise<void> {
    try {
      await this.memoryStore!.append(sessionId, userMessage);
      await this.memoryStore!.append(sessionId, assistantMessage);
    } catch {
      // Non-critical — telemetry not needed here to avoid recursion
    }
  }

  /**
   * Wraps a provider's async iterable to emit telemetry on the final chunk
   * and optionally persist memory on stream completion.
   */
  private async *wrapStream(
    providerId: string,
    source: AsyncIterable<StreamResponse>,
    sessionId?: string,
    userMessage?: ChatMessage,
  ): AsyncIterable<StreamResponse> {
    const startMs = Date.now();
    const collectedContent: string[] = [];

    try {
      for await (const chunk of source) {
        if (chunk.delta) collectedContent.push(chunk.delta);
        yield chunk;

        if (chunk.isDone) {
          this.telemetry.recordLatency(providerId, Date.now() - startMs);
          if (chunk.usage) {
            this.telemetry.recordTokenUsage(providerId, chunk.usage);
          }
          this.telemetry.recordEvent('orchestrator.stream.completed', { providerId, sessionId });

          // Persist stream result to memory
          if (this.memoryStore !== undefined && sessionId !== undefined && userMessage !== undefined) {
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: collectedContent.join(''),
              createdAt: new Date().toISOString(),
            };
            void this.persistMessages(sessionId, userMessage, assistantMessage);
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.telemetry.recordError(providerId, error);
      this.telemetry.recordEvent('orchestrator.stream.error', { providerId, errorName: error.name });
      throw error;
    }
  }
}
