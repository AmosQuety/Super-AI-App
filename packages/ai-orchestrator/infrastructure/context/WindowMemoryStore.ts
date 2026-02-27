import type { IMemoryStore } from '../../core/ports/IMemoryStore.js';
import type { ChatMessage } from '../../core/entities/ChatMessage.js';
import { createChatMessage } from '../../core/entities/ChatMessage.js';

/** Configuration for {@link WindowMemoryStore}. */
export interface WindowMemoryStoreConfig {
  /**
   * Maximum number of messages to keep per session.
   * When this limit is reached, the oldest messages are evicted.
   * @default 100
   */
  readonly maxMessagesPerSession: number;
}

/**
 * In-memory sliding-window implementation of {@link IMemoryStore}.
 *
 * Behaviour:
 * - Messages are stored in insertion (chronological) order.
 * - When `maxMessagesPerSession` is exceeded, the **oldest** messages
 *   are evicted first (FIFO eviction).
 * - Each session is fully isolated from other sessions.
 * - Data is not persisted across process restarts — this store is
 *   intended for short-term / ephemeral sessions.
 *
 * Thread-safety: JavaScript is single-threaded, so no locking is needed.
 */
export class WindowMemoryStore implements IMemoryStore {
  private readonly sessions: Map<string, ChatMessage[]>;
  private readonly config: WindowMemoryStoreConfig;

  constructor(config?: Partial<WindowMemoryStoreConfig>) {
    this.config = {
      maxMessagesPerSession: 100,
      ...config,
    };
    this.sessions = new Map();
  }

  async append(sessionId: string, message: ChatMessage): Promise<void> {
    let history = this.sessions.get(sessionId);
    if (!history) {
      history = [];
      this.sessions.set(sessionId, history);
    }

    history.push(message);

    // Evict oldest messages if over capacity
    const overflow = history.length - this.config.maxMessagesPerSession;
    if (overflow > 0) {
      history.splice(0, overflow);
    }
  }

  async getHistory(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const history = this.sessions.get(sessionId) ?? [];
    if (limit === undefined || limit >= history.length) {
      return [...history];
    }
    // Return the `limit` most-recent messages
    return history.slice(history.length - limit);
  }

  async clear(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /**
   * Returns the current number of active sessions.
   * Useful for health checks and debugging.
   */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Returns the number of messages stored for a given session.
   */
  messageCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.length ?? 0;
  }
}
