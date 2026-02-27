/**
 * The output produced by executing a single {@link ToolCall} inside the
 * {@link ToolSandbox}.
 *
 * Both successful results and errors are represented by this type.
 * `isError` distinguishes them so the model can reason about failures
 * without the framework throwing.
 */
export interface ToolResult {
  /**
   * The `id` of the {@link ToolCall} this result corresponds to.
   * Used by the tool loop to pair calls with results when building messages.
   */
  readonly toolCallId: string;

  /**
   * The tool name. Included for convenience when building message turns.
   */
  readonly toolName: string;

  /**
   * JSON-serialised return value on success, or a structured error description
   * on failure. Always a non-null string so the model can read it.
   */
  readonly content: string;

  /**
   * `true` when the sandbox captured an exception or a timeout.
   * The model receives this as context so it can decide whether to retry or abort.
   */
  readonly isError: boolean;
}

/**
 * Factory for constructing a successful {@link ToolResult}.
 */
export function createToolResult(
  toolCallId: string,
  toolName: string,
  value: unknown,
): ToolResult {
  const content =
    typeof value === 'string' ? value : JSON.stringify(value, null, 0);
  return Object.freeze({ toolCallId, toolName, content, isError: false });
}

/**
 * Factory for constructing an error {@link ToolResult}.
 */
export function createErrorToolResult(
  toolCallId: string,
  toolName: string,
  error: Error,
): ToolResult {
  const content = JSON.stringify({ error: error.name, message: error.message });
  return Object.freeze({ toolCallId, toolName, content, isError: true });
}
