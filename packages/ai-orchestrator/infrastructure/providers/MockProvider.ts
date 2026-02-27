import type { IProvider } from '../../core/ports/IProvider.js';
import type { ChatMessage } from '../../core/entities/ChatMessage.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import type { FinalResponse } from '../../core/entities/FinalResponse.js';
import type { StreamResponse } from '../../core/entities/StreamResponse.js';
import type { ProviderCapabilities } from '../../core/entities/ProviderCapabilities.js';
import { createTokenUsage } from '../../core/entities/TokenUsage.js';

/**
 * Configuration for constructing a {@link MockProvider}.
 */
export interface MockProviderConfig {
  /** The provider ID — defaults to `'mock'`. */
  readonly id?: string;
  /**
   * Scripted queue of responses to return from `complete()`.
   * Responses are consumed in FIFO order. When the queue is exhausted,
   * subsequent calls throw `Error('MockProvider queue exhausted')`.
   */
  readonly responses?: FinalResponse[];
  /**
   * Scripted queue of streaming chunk arrays for `stream()`.
   * Each call dequeues one `StreamResponse[]` and yields its items.
   */
  readonly streamChunks?: StreamResponse[][];
  /**
   * Number of leading calls to `complete()` that will be force-rejected
   * with `Error('MockProvider: forced failure')`. Useful for testing
   * retry and fallback behaviour.
   */
  readonly forceFailCount?: number;
  /** Capability overrides. Defaults to full capabilities. */
  readonly capabilities?: Partial<ProviderCapabilities>;
  /** Return value for `healthCheck()`. Defaults to `true`. */
  readonly healthy?: boolean;
}

/**
 * Scripted, in-memory {@link IProvider} for testing.
 *
 * ## Features
 * - **Response queue**: supply `FinalResponse[]` consumed FIFO.
 * - **Failure injection**: `forceFailCount` rejects the first N calls.
 * - **Streaming**: supply `streamChunks` arrays consumed FIFO.
 * - **Call inspection**: `callCount`, `lastMessages`, `lastOptions`.
 * - **Health toggle**: set `healthy` to `false` for health-check tests.
 *
 * This class is deliberately NOT exported from the package root — it is
 * in the `infrastructure/providers` layer and intended for test wiring only.
 */
export class MockProvider implements IProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  private readonly responseQueue: FinalResponse[];
  private readonly streamQueue: StreamResponse[][];
  private forceFailRemaining: number;
  private readonly healthy: boolean;

  /** Total number of `complete()` calls received (including failures). */
  callCount = 0;
  /** Snapshot of the `messages` argument from the most recent `complete()` call. */
  lastMessages: readonly ChatMessage[] = [];
  /** Snapshot of the `options` argument from the most recent `complete()` call. */
  lastOptions: CompletionOptions = {};

  constructor(config: MockProviderConfig = {}) {
    this.id = config.id ?? 'mock';
    this.responseQueue = [...(config.responses ?? [makeFallbackResponse(this.id)])];
    this.streamQueue = [...(config.streamChunks ?? [])];
    this.forceFailRemaining = config.forceFailCount ?? 0;
    this.healthy = config.healthy ?? true;
    this.capabilities = {
      supportsStreaming: true,
      supportsSystemPrompt: true,
      maxContextTokens: 128_000,
      supportedModels: [],
      ...(config.capabilities ?? {}),
    };
  }

  // ── IProvider ──────────────────────────────────────────────────────────────

  async complete(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<FinalResponse> {
    this.callCount++;
    this.lastMessages = messages;
    this.lastOptions = options;

    if (this.forceFailRemaining > 0) {
      this.forceFailRemaining--;
      throw new Error('MockProvider: forced failure');
    }

    const response = this.responseQueue.shift();
    if (response === undefined) {
      throw new Error('MockProvider queue exhausted — add more responses to the config');
    }
    return response;
  }

  async *stream(
    _messages: readonly ChatMessage[],
    _options: CompletionOptions,
  ): AsyncIterable<StreamResponse> {
    const chunks = this.streamQueue.shift();
    if (chunks === undefined) {
      throw new Error('MockProvider stream queue exhausted');
    }
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.healthy;
  }

  // ── Test helpers ───────────────────────────────────────────────────────────

  /**
   * Pushes additional responses onto the end of the queue at runtime.
   * Useful when a test requires responses to be added dynamically.
   */
  enqueue(...responses: FinalResponse[]): void {
    this.responseQueue.push(...responses);
  }

  /** Returns `true` when the response queue has been fully consumed. */
  get queueEmpty(): boolean {
    return this.responseQueue.length === 0;
  }
}

// ── Default response factory ───────────────────────────────────────────────

function makeFallbackResponse(providerId: string): FinalResponse {
  return {
    id: 'mock-resp-default',
    content: 'Mock response',
    model: 'mock-model',
    provider: providerId,
    usage: createTokenUsage(10, 20),
    finishReason: 'stop',
    createdAt: new Date().toISOString(),
  };
}
