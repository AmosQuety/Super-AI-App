import type { ChatMessage } from '../entities/ChatMessage.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';
import type { IProvider } from './IProvider.js';

/**
 * Routing port — selects the appropriate {@link IProvider} for a given request.
 *
 * Implementations can apply any routing strategy:
 *   - Cost-based routing
 *   - Capability-based routing (e.g. streaming required)
 *   - Load-based or latency-based routing
 *   - Failover / fallback chaining
 *
 * The core orchestration layer depends only on this interface;
 * the concrete strategy lives in infrastructure.
 */
export interface IRouter {
  /**
   * Selects a provider for the given messages and completion options.
   *
   * @param messages - The message history for context-aware routing decisions.
   * @param options  - Completion options that may constrain provider selection
   *                   (e.g. `options.provider` for explicit pinning,
   *                    `options.stream` for streaming-capable routing).
   * @returns A promise resolving to the selected {@link IProvider}.
   * @throws {RouterError} if no suitable provider can be found.
   */
  route(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<IProvider>;
}
