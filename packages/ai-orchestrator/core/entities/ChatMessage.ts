/**
 * Represents a single turn in a conversation.
 * Immutable value object — construct with the factory function.
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  /** Unique identifier for this message (UUID v4). */
  readonly id: string;
  /** The role of the sender. */
  readonly role: MessageRole;
  /** The text content of the message. */
  readonly content: string;
  /** ISO-8601 timestamp of when this message was created. */
  readonly createdAt: string;
  /** Optional caller-supplied metadata (e.g. tool call results, attachment refs). */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Factory for constructing a {@link ChatMessage}.
 * Generates a stable {@link createdAt} timestamp at construction time.
 */
export function createChatMessage(
  params: Omit<ChatMessage, 'createdAt'> & { createdAt?: string },
): ChatMessage {
  return Object.freeze({
    id: params.id,
    role: params.role,
    content: params.content,
    createdAt: params.createdAt ?? new Date().toISOString(),
    metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined,
  });
}
