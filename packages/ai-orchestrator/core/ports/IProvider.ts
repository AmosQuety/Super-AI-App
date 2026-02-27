import type { ChatMessage } from '../entities/ChatMessage.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';
import type { FinalResponse } from '../entities/FinalResponse.js';
import type { ProviderCapabilities } from '../entities/ProviderCapabilities.js';
import type { StreamResponse } from '../entities/StreamResponse.js';

/**
 * Primary port — the boundary between the core orchestration layer and any
 * concrete AI provider SDK.
 *
 * Infrastructure adapters (e.g. OpenAI, Gemini, HuggingFace) implement this
 * interface. The core layer never imports any SDK directly.
 */
export interface IProvider {
  /**
   * Globally unique identifier for this provider instance.
   * Used as the registry key and in telemetry labels.
   * Example: "openai", "gemini-pro", "huggingface-mistral"
   */
  readonly id: string;

  /**
   * Declares the functional capabilities of this provider.
   * Queried by the router to make capability-aware routing decisions.
   */
  readonly capabilities: ProviderCapabilities;

  /**
   * Sends a completion request and waits for the full response.
   *
   * @param messages - Ordered message history to send to the model.
   * @param options  - Completion configuration for this request.
   * @returns A promise that resolves to the full {@link FinalResponse}.
   * @throws {ProviderError} on unrecoverable provider-side failure.
   */
  complete(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<FinalResponse>;

  /**
   * Initiates a streaming completion and returns an async iterable of chunks.
   *
   * Each yielded {@link StreamResponse} carries an incremental {@link StreamResponse.delta}.
   * The final chunk has {@link StreamResponse.isDone} set to `true`.
   *
   * @param messages - Ordered message history to send to the model.
   * @param options  - Completion configuration for this request.
   * @returns An async iterable of {@link StreamResponse} chunks.
   * @throws {ProviderError} if streaming is unsupported or the request fails.
   */
  stream(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): AsyncIterable<StreamResponse>;

  /**
   * Performs a lightweight liveness check against the provider endpoint.
   *
   * @returns `true` if the provider is reachable and healthy, `false` otherwise.
   * Implementations must not throw — failures must be returned as `false`.
   */
  healthCheck(): Promise<boolean>;
}
