import type { ChatMessage } from '../entities/ChatMessage.js';

/**
 * Summarization strategy port — condenses a block of messages into a
 * single summary {@link ChatMessage}.
 *
 * Implementations may use:
 *   - A dedicated AI provider call ({@link ProviderSummarizationStrategy})
 *   - A deterministic extractive summarizer (e.g. first + last N tokens)
 *   - A custom heuristic (for offline / low-cost environments)
 *
 * The summary message should use `role: 'system'` and clearly mark itself
 * as a summary so the context builder can distinguish it from original content.
 */
export interface ISummarizationStrategy {
  /**
   * Summarizes a sequence of messages into a single representative message.
   *
   * @param messages - Ordered messages to summarize (oldest first).
   * @returns A single {@link ChatMessage} encapsulating the summary.
   */
  summarize(messages: readonly ChatMessage[]): Promise<ChatMessage>;
}
