/**
 * Configuration for {@link ContextBuilder}.
 * Created once at startup and injected as a dependency.
 */
export interface ContextBuilderConfig {
  /**
   * Optional system prompt prepended to every request.
   * Set to `undefined` to omit (e.g. for providers that don't support system roles).
   */
  readonly systemPrompt?: string;

  /**
   * Maximum number of RAG document chunks to inject per request.
   * Set to 0 to disable RAG injection entirely.
   * @default 5
   */
  readonly maxDocumentChunks: number;

  /**
   * Separator inserted between adjacent RAG chunks in the injected message.
   * @default '\n---\n'
   */
  readonly documentChunkSeparator: string;

  /**
   * Tokens to reserve for the model's reply when building the token budget.
   * @default 512
   */
  readonly reservedResponseTokens: number;

  /**
   * Minimum number of messages to keep in context even if the budget is exceeded.
   * Prevents the context window from being trimmed to nothing.
   * @default 2
   */
  readonly minMessagesToKeep: number;
}

/** Creates a {@link ContextBuilderConfig} with sensible defaults. */
export function createContextBuilderConfig(
  overrides?: Partial<ContextBuilderConfig>,
): ContextBuilderConfig {
  return Object.freeze({
    systemPrompt: undefined,
    maxDocumentChunks: 5,
    documentChunkSeparator: '\n---\n',
    reservedResponseTokens: 512,
    minMessagesToKeep: 2,
    ...overrides,
  });
}
