import type { ChatMessage } from '../entities/ChatMessage.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';

/**
 * Context builder port — assembles the message window that is sent to a provider.
 *
 * Responsibilities:
 *   - Retrieve relevant history from the memory store
 *   - Apply token-budget trimming (sliding window / summarization)
 *   - Prepend system prompts if required
 *   - Inject retrieved knowledge (RAG) chunks if applicable
 *
 * The concrete implementation is injected at runtime.
 */
export interface IContextBuilder {
  /**
   * Builds the final ordered message list to send to a provider.
   *
   * @param sessionId   - Session identifier used to look up prior history.
   * @param userMessage - The latest user message to append.
   * @param options     - Completion options (e.g. `maxTokens` informs trimming).
   * @returns An ordered array of {@link ChatMessage} ready for provider dispatch.
   */
  build(
    sessionId: string,
    userMessage: ChatMessage,
    options: CompletionOptions,
  ): Promise<ChatMessage[]>;
}
