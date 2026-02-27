import type { TokenUsage } from './TokenUsage.js';
import type { ToolCall } from '../tools/ToolCall.js';

/**
 * The reason the provider stopped generating tokens.
 */
export type FinishReason =
  | 'stop'        // Natural end of completion
  | 'length'      // maxTokens reached
  | 'content_filter' // Content was filtered
  | 'tool_calls'  // Model requested tool execution
  | 'error'       // Provider-side error mid-generation
  | 'unknown';

/**
 * The fully-resolved output of a non-streaming completion request.
 */
export interface FinalResponse {
  /** Unique response identifier (provider-supplied or generated). */
  readonly id: string;
  /** The text content produced by the model. */
  readonly content: string;
  /** The model that generated this response. */
  readonly model: string;
  /** The identifier of the provider that fulfilled the request. */
  readonly provider: string;
  /** Token usage for this completion. */
  readonly usage: TokenUsage;
  /** The reason the model stopped producing tokens. */
  readonly finishReason: FinishReason;
  /** ISO-8601 timestamp when the response was received. */
  readonly createdAt: string;
  /** Optional provider-specific metadata or structured content. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /**
   * Tool calls requested by the model in this response.
   * Populated only when `finishReason === 'tool_calls'`.
   * The {@link ToolLoop} reads this to drive multi-step execution.
   */
  readonly toolCalls?: readonly ToolCall[];
}
