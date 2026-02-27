/**
 * Represents a single tool invocation requested by the model within a response.
 *
 * A {@link FinalResponse} with `finishReason === 'tool_calls'` will carry one
 * or more of these in its `toolCalls` field.
 * The orchestrator passes them to the {@link ToolEngine} for safe execution.
 */
export interface ToolCall {
  /**
   * Provider-assigned identifier for this specific tool call instance.
   * Must be echoed back in the corresponding {@link ToolResult.toolCallId}.
   */
  readonly id: string;

  /**
   * The name of the tool to invoke. Must match a name in the {@link IToolRegistry}.
   */
  readonly name: string;

  /**
   * Arguments parsed from the model's JSON output.
   * Validated against the tool's JSON Schema by the model; treated as-is here.
   */
  readonly arguments: Readonly<Record<string, unknown>>;
}

/**
 * Factory function for constructing a {@link ToolCall}.
 */
export function createToolCall(
  params: ToolCall,
): ToolCall {
  return Object.freeze({ ...params });
}
