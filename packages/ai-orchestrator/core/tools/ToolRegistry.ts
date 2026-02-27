import type { IToolRegistry } from '../ports/IToolRegistry.js';
import type { ToolDefinition } from './ToolDefinition.js';
import { DuplicateToolError, ToolNotFoundError } from './ToolErrors.js';

/**
 * In-process, in-memory implementation of {@link IToolRegistry}.
 *
 * Tools are stored in insertion order. Registration is additive — there is
 * no remove/replace API to keep the registry simple and prevent race
 * conditions in concurrent environments.
 *
 * Thread / concurrency note: JavaScript is single-threaded. This registry is
 * safe for any async usage pattern within a single Node.js process.
 */
export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  /**
   * Registers a new tool definition.
   *
   * @throws {DuplicateToolError} if `tool.name` is already registered.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new DuplicateToolError(tool.name);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Retrieves a registered tool by its unique name.
   *
   * @throws {ToolNotFoundError} if `name` is not in the registry.
   */
  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (tool === undefined) {
      throw new ToolNotFoundError(name);
    }
    return tool;
  }

  /**
   * Returns an immutable snapshot of all registered tools in insertion order.
   */
  list(): readonly ToolDefinition[] {
    return Object.freeze([...this.tools.values()]);
  }
}
