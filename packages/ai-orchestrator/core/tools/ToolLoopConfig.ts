/**
 * Configuration for the {@link ToolLoop} agentic reasoning control.
 */
export interface ToolLoopConfig {
  /**
   * Maximum number of tool-call iterations before the loop aborts.
   * Prevents infinite cycles where the model continuously emits tool calls.
   *
   * @default 10
   */
  readonly maxLoops: number;

  /**
   * Wall-clock timeout in milliseconds applied to each individual tool handler.
   * When a handler exceeds this limit the sandbox produces an error result
   * and the loop continues (the model is informed of the timeout).
   *
   * @default 15_000
   */
  readonly toolTimeoutMs: number;
}

const DEFAULTS: ToolLoopConfig = {
  maxLoops: 10,
  toolTimeoutMs: 15_000,
};

/**
 * Factory that merges caller-supplied overrides with production defaults.
 *
 * @example
 * ```ts
 * const config = createToolLoopConfig({ maxLoops: 5 });
 * // → { maxLoops: 5, toolTimeoutMs: 15_000 }
 * ```
 */
export function createToolLoopConfig(
  overrides: Partial<ToolLoopConfig> = {},
): ToolLoopConfig {
  const maxLoops = overrides.maxLoops ?? DEFAULTS.maxLoops;
  const toolTimeoutMs = overrides.toolTimeoutMs ?? DEFAULTS.toolTimeoutMs;

  if (maxLoops < 1) {
    throw new RangeError(`maxLoops must be at least 1, got ${maxLoops}`);
  }
  if (toolTimeoutMs < 1) {
    throw new RangeError(`toolTimeoutMs must be at least 1, got ${toolTimeoutMs}`);
  }

  return Object.freeze({ maxLoops, toolTimeoutMs });
}
