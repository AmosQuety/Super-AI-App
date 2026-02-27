/**
 * Describes the functional capabilities of an AI provider.
 * Used by the router to make capability-aware routing decisions.
 */
export interface ProviderCapabilities {
  /** Whether the provider supports streaming partial completions. */
  readonly supportsStreaming: boolean;
  /** Whether the provider honours a system-role prompt in message history. */
  readonly supportsSystemPrompt: boolean;
  /** Maximum number of tokens accepted in the combined prompt + completion. */
  readonly maxContextTokens: number;
  /**
   * The set of model identifiers available through this provider.
   * An empty array means all models are accepted (open-ended provider).
   */
  readonly supportedModels: readonly string[];
}
