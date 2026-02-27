/**
 * Thrown by {@link ToolRegistry.get} when the requested tool name is not registered.
 */
export class ToolNotFoundError extends Error {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool not registered: "${toolName}"`);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by {@link ToolRegistry.register} when a tool with the same name
 * has already been registered. Use a unique name for each tool.
 */
export class DuplicateToolError extends Error {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool already registered: "${toolName}". Tool names must be unique.`);
    this.name = 'DuplicateToolError';
    this.toolName = toolName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Captured and surfaced by the {@link ToolSandbox} when a tool handler
 * throws an unexpected error.
 *
 * This error is NOT propagated to callers — the sandbox converts it into a
 * {@link ToolResult} with `isError: true`. It is exposed here so callers
 * can inspect traces if needed.
 */
export class ToolExecutionError extends Error {
  readonly toolName: string;
  readonly cause: Error;

  constructor(toolName: string, cause: Error) {
    super(`Tool "${toolName}" threw an error: ${cause.message}`);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised internally by the {@link ToolSandbox} when a handler exceeds its
 * configured `timeoutMs`. Also converted to a {@link ToolResult} with
 * `isError: true` — never propagated as a thrown exception.
 */
export class ToolTimeoutError extends Error {
  readonly toolName: string;
  readonly timeoutMs: number;

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool "${toolName}" timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by {@link ToolLoop} when the agentic reasoning loop reaches the
 * configured `maxLoops` limit without the model producing a terminal response.
 */
export class MaxLoopsExceededError extends Error {
  readonly maxLoops: number;

  constructor(maxLoops: number) {
    super(
      `Tool loop exceeded the maximum of ${maxLoops} iteration(s) without reaching a terminal state. ` +
      `The model may be stuck in a tool-call cycle.`,
    );
    this.name = 'MaxLoopsExceededError';
    this.maxLoops = maxLoops;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
