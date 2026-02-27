import type { IToolRegistry } from '../ports/IToolRegistry.js';
import type { ToolCall } from './ToolCall.js';
import type { ToolResult } from './ToolResult.js';
import { createErrorToolResult } from './ToolResult.js';
import { ToolNotFoundError } from './ToolErrors.js';
import { ToolSandbox } from './ToolSandbox.js';

/**
 * Stateless service that executes a batch of {@link ToolCall}s.
 *
 * Responsibilities:
 * - Looks up each tool in the {@link IToolRegistry}.
 * - Delegates safe execution to the {@link ToolSandbox} (timeout + error capture).
 * - If a tool is not registered, produces an error {@link ToolResult} inline
 *   so the model can be informed rather than crashing the loop.
 * - All tool calls within a single turn are executed **in parallel** for
 *   throughput, since they are logically independent requests.
 *
 * This class contains no state — it is safe to reuse across multiple calls.
 */
export class ToolEngine {
  private readonly sandbox: ToolSandbox;

  /**
   * @param registry   - Registry from which tool definitions are resolved.
   * @param timeoutMs  - Per-handler timeout enforced by the sandbox.
   */
  constructor(
    private readonly registry: IToolRegistry,
    timeoutMs: number,
  ) {
    this.sandbox = new ToolSandbox(timeoutMs);
  }

  /**
   * Executes all provided tool calls and returns their results.
   *
   * Results are returned in the same order as the input calls.
   * Each result is guaranteed to be present — failed lookups or handler
   * errors produce an error result rather than throwing.
   *
   * @param calls - The tool invocations requested by the model in one turn.
   * @returns An ordered array of {@link ToolResult}s.
   */
  async executeAll(calls: readonly ToolCall[]): Promise<readonly ToolResult[]> {
    const tasks = calls.map((call) => this.executeSingle(call));
    return Promise.all(tasks);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async executeSingle(call: ToolCall): Promise<ToolResult> {
    let definition;
    try {
      definition = this.registry.get(call.name);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      return createErrorToolResult(call.id, call.name, error);
    }

    return this.sandbox.execute(call, definition);
  }
}
