import type { IProvider } from '../../core/ports/IProvider.js';
import type { ChatMessage } from '../../core/entities/ChatMessage.js';
import type { CompletionOptions } from '../../core/entities/CompletionOptions.js';
import type { FinalResponse } from '../../core/entities/FinalResponse.js';
import type { StreamResponse } from '../../core/entities/StreamResponse.js';
import type { ProviderCapabilities } from '../../core/entities/ProviderCapabilities.js';
import type { ToolCall } from '../../core/tools/ToolCall.js';
import type { FinishReason } from '../../core/entities/FinalResponse.js';
import { createTokenUsage } from '../../core/entities/TokenUsage.js';

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Constructor configuration for {@link OpenAIProvider}.
 */
export interface OpenAIProviderConfig {
  /** OpenAI API key (`sk-...`). */
  readonly apiKey: string;
  /** Default model to use when `options.model` is not specified. */
  readonly model: string;
  /**
   * Override base URL for proxies or compatible endpoints.
   * @default 'https://api.openai.com'
   */
  readonly baseUrl?: string;
  /**
   * Request timeout in milliseconds.
   * @default 30_000
   */
  readonly timeoutMs?: number;
}

// ── OpenAI wire types (no SDK — raw fetch) ────────────────────────────────────

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface OpenAIChoice {
  message: OpenAIMessage;
  finish_reason: string;
  index: number;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIStreamDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: { name?: string; arguments?: string };
  }>;
}

interface OpenAIStreamChoice {
  delta: OpenAIStreamDelta;
  finish_reason: string | null;
  index: number;
}

interface OpenAIStreamChunk {
  id: string;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage;
}

// ── Provider errors ───────────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── OpenAIProvider ────────────────────────────────────────────────────────────

/**
 * Production adapter for the OpenAI Chat Completions API.
 *
 * ## Design
 * - Uses raw `fetch` only — zero SDK dependencies, zero SDK types in core.
 * - Maps all OpenAI response fields to framework core types.
 * - Throws {@link ProviderError} on HTTP errors or network failures.
 * - `stream()` parses server-sent events (SSE) line-by-line.
 * - `healthCheck()` pings `/v1/models` with a short 2s timeout.
 *
 * ## Wiring example
 * ```ts
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4o',
 * });
 * ```
 */
export class OpenAIProvider implements IProvider {
  readonly id = 'openai';
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextTokens: 128_000,
    supportedModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  };

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenAIProviderConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ── IProvider ──────────────────────────────────────────────────────────────

  async complete(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<FinalResponse> {
    const body = this.buildRequestBody(messages, options, false);
    const raw = await this.post<OpenAIResponse>('/v1/chat/completions', body, this.timeoutMs);

    const choice = raw.choices[0];
    if (choice === undefined) {
      throw new ProviderError(this.id, 'OpenAI returned no choices in the response');
    }

    const toolCalls = this.mapToolCalls(choice.message.tool_calls);

    return Object.freeze({
      id: raw.id,
      content: choice.message.content ?? '',
      model: raw.model,
      provider: this.id,
      usage: createTokenUsage(raw.usage.prompt_tokens, raw.usage.completion_tokens, raw.usage.total_tokens),
      finishReason: this.mapFinishReason(choice.finish_reason),
      createdAt: new Date().toISOString(),
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    });
  }

  async *stream(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): AsyncIterable<StreamResponse> {
    const body = this.buildRequestBody(messages, options, true);
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      },
      this.timeoutMs,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new ProviderError(this.id, `OpenAI stream error ${response.status}: ${errorText}`, response.status);
    }

    if (!response.body) {
      throw new ProviderError(this.id, 'OpenAI response body is null — cannot stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let responseId = '';
    let responseModel = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(data) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          responseId = responseId || chunk.id;
          responseModel = responseModel || chunk.model;
          const choice = chunk.choices[0];
          if (!choice) continue;

          const isDone = choice.finish_reason !== null;
          yield Object.freeze({
            id: responseId,
            delta: choice.delta.content ?? '',
            model: responseModel,
            provider: this.id,
            isDone,
            ...(isDone && chunk.usage
              ? {
                  usage: createTokenUsage(
                    chunk.usage.prompt_tokens,
                    chunk.usage.completion_tokens,
                    chunk.usage.total_tokens,
                  ),
                }
              : {}),
          });
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/v1/models`,
        { method: 'GET', headers: this.buildHeaders() },
        2_000,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildRequestBody(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.config.model,
      messages: messages.map(this.mapMessage),
      stream,
    };
    if (options.temperature !== undefined) body['temperature'] = options.temperature;
    if (options.maxTokens !== undefined) body['max_tokens'] = options.maxTokens;
    if (options.topP !== undefined) body['top_p'] = options.topP;
    if (options.stop !== undefined) body['stop'] = options.stop;
    if (options.tools !== undefined && options.tools.length > 0) {
      body['tools'] = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body['tool_choice'] = 'auto';
    }
    return body;
  }

  private mapMessage(msg: ChatMessage): Record<string, unknown> {
    const base: Record<string, unknown> = { role: msg.role, content: msg.content };
    if (msg.role === 'tool' && msg.metadata?.toolCallId) {
      base['tool_call_id'] = msg.metadata.toolCallId;
    }
    if (msg.role === 'assistant' && msg.metadata?.toolCalls) {
      const toolCalls = msg.metadata.toolCalls as Array<{
        id: string; name: string; arguments: Record<string, unknown>;
      }>;
      base['tool_calls'] = toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
    }
    return base;
  }

  private mapToolCalls(
    rawCalls?: OpenAIMessage['tool_calls'],
  ): readonly ToolCall[] {
    if (!rawCalls?.length) return [];
    return rawCalls.map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch { /* keep empty */ }
      return Object.freeze({ id: tc.id, name: tc.function.name, arguments: args });
    });
  }

  private mapFinishReason(raw: string): FinishReason {
    switch (raw) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      case 'tool_calls': return 'tool_calls';
      default: return 'unknown';
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${this.baseUrl}${path}`,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
        },
        timeoutMs,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ProviderError(this.id, `OpenAI network error: ${msg}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new ProviderError(
        this.id,
        `OpenAI API error ${response.status}: ${errorText}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }

  private fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
    });
  }
}
