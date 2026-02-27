import type { ChatMessage } from '../entities/ChatMessage.js';

/**
 * Memory store port — persists and retrieves conversation history.
 *
 * Implementations can be backed by any storage medium:
 *   - In-memory (for testing / ephemeral sessions)
 *   - Redis (for distributed, low-latency access)
 *   - A relational or document database (for durable history)
 *
 * The core layer interacts only with this interface; the storage
 * adapter is supplied via dependency injection.
 */
export interface IMemoryStore {
  /**
   * Appends a single message to the history of a session.
   *
   * @param sessionId - Unique session / conversation identifier.
   * @param message   - The message to persist.
   */
  append(sessionId: string, message: ChatMessage): Promise<void>;

  /**
   * Retrieves the message history for a session, ordered oldest-first.
   *
   * @param sessionId - Unique session / conversation identifier.
   * @param limit     - Optional maximum number of most-recent messages to return.
   *                    If omitted, all stored messages are returned.
   * @returns An ordered array of {@link ChatMessage}, may be empty.
   */
  getHistory(sessionId: string, limit?: number): Promise<ChatMessage[]>;

  /**
   * Clears all stored messages for a session.
   *
   * @param sessionId - Unique session / conversation identifier.
   */
  clear(sessionId: string): Promise<void>;
}
