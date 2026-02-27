import type { ToolDefinition } from '../tools/ToolDefinition.js';
import type { TenantContext } from './TenantContext.js';


/**
 * Configuration options for a provider completion request.
 * All fields are optional to allow partial overrides at call-site.
 */
export interface CompletionOptions {
  /**
   * The model identifier to use (e.g. "gpt-4o", "gemini-1.5-pro").
   * If omitted, the provider or router applies a default.
   */
  readonly model?: string;

  /**
   * Sampling temperature in [0, 2]. Higher values increase randomness.
   * @default 0.7
   */
  readonly temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  readonly maxTokens?: number;

  /**
   * Nucleus sampling probability mass. Values in (0, 1].
   * @default 1
   */
  readonly topP?: number;

  /**
   * Up to 4 sequences where the API will stop generating tokens.
   */
  readonly stop?: readonly string[];

  /**
   * Whether to stream the response as partial deltas.
   * @default false
   */
  readonly stream?: boolean;

  /**
   * Request timeout in milliseconds. Defaults to the provider's own timeout.
   */
  readonly timeoutMs?: number;

  /**
   * Optional explicit provider identifier to bypass routing logic.
   * When set, the router must select this provider if registered.
   */
  readonly provider?: string;

  /**
   * Optional session identifier linking this request to a memory store session.
   * When set and a {@link IMemoryStore} is configured in the orchestrator,
   * conversation history is loaded and persisted under this key.
   */
  readonly sessionId?: string;

  /**
   * Tools made available to the model for this request.
   * When provided and the model requests tool calls, the orchestrator's
   * {@link ToolLoop} will execute them and continue the conversation.
   *
   * When omitted, tool-call behaviour is disabled for this request.
   */
  readonly tools?: readonly ToolDefinition[];

  /**
   * Optional context identifying the tenant and user making the request.
   * When provided, the {@link AdaptiveRouter} will enforce cost limits
   * via {@link ICostGuard} and apply routing policies via {@link IPolicyEngine}.
   */
  readonly tenantContext?: TenantContext;
}
