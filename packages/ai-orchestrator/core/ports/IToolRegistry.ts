import type { ToolDefinition } from '../tools/ToolDefinition.js';
import { ToolNotFoundError } from '../tools/ToolErrors.js';

/**
 * Port — the boundary through which the core tool layer accesses
 * registered tool definitions.
 *
 * Infrastructure adapters may implement this interface to source tools
 * from a database or remote registry. For in-process use, the concrete
 * {@link ToolRegistry} implementation is provided.
 */
export interface IToolRegistry {
  /**
   * Registers a new tool.
   *
   * @param tool - The tool definition to register.
   * @throws {DuplicateToolError} if a tool with the same `name` is already registered.
   */
  register(tool: ToolDefinition): void;

  /**
   * Retrieves a registered tool by name.
   *
   * @param name - The unique tool name.
   * @returns The {@link ToolDefinition} for the requested tool.
   * @throws {ToolNotFoundError} if the tool has not been registered.
   */
  get(name: string): ToolDefinition;

  /**
   * Returns an ordered snapshot of all currently registered tools.
   * The returned array is immutable.
   */
  list(): readonly ToolDefinition[];
}
