import type { ToolDefinition } from './ToolDefinition.js';
import type { ToolCall } from './ToolCall.js';
import type { ToolResult } from './ToolResult.js';
import { createToolResult, createErrorToolResult } from './ToolResult.js';
import { ToolTimeoutError } from './ToolErrors.js';

/**
 * Wraps a single tool handler invocation in a hardened execution context.
 *
 * Safety guarantees:
 * - **Timeout enforcement**: If the handler does not resolve within
 *   `timeoutMs`, a {@link ToolTimeoutError} is captured.
 * - **Error capture**: Any exception thrown by the handler is captured and
 *   converted to an error {@link ToolResult}. The sandbox NEVER re-throws.
 * - **Result serialisation**: The resolved value is JSON-serialised, so
 *   the model always receives a string regardless of what the handler returns.
 *
 * This class is stateless — each `execute` call is fully independent.
 */
export class ToolSandbox {
  constructor(private readonly timeoutMs: number) {}

  /**
   * Safely executes the handler for the given tool call.
   *
   * @param call       - The tool invocation requested by the model.
   * @param definition - The registered {@link ToolDefinition} for this tool.
   * @returns A {@link ToolResult} containing either the serialised return value
   *          or a structured error description. Never throws.
   */
  async execute(call: ToolCall, definition: ToolDefinition): Promise<ToolResult> {
    try {
      const result = await Promise.race([
        definition.handler(call.arguments),
        this.buildTimeoutPromise(call.name, this.timeoutMs),
      ]);
      return createToolResult(call.id, call.name, result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return createErrorToolResult(call.id, call.name, error);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildTimeoutPromise(
    toolName: string,
    timeoutMs: number,
  ): Promise<never> {
    return new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new ToolTimeoutError(toolName, timeoutMs)),
        timeoutMs,
      );
      // Ensure the timer does not prevent Node.js from exiting in test environments
      if (typeof timer === 'object' && 'unref' in timer) {
        (timer as NodeJS.Timeout).unref();
      }
    });
  }
}
