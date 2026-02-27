import type { ToolCall } from './ToolCall.js';
import type { ToolResult } from './ToolResult.js';

/**
 * A single step in the agentic reasoning loop.
 * Provides full observability into what the model requested and what each tool returned.
 */
export interface LoopStep {
  /** 1-based iteration index (step 1 = first tool-call turn). */
  readonly stepIndex: number;
  /** Tool calls the model requested in this iteration. */
  readonly toolCalls: readonly ToolCall[];
  /** Results produced by the {@link ToolEngine} for this iteration. */
  readonly toolResults: readonly ToolResult[];
}

/**
 * Immutable trace produced by a completed {@link ToolLoop} run.
 * Useful for debugging, audit logging, and observability adapters.
 */
export interface LoopTrace {
  /** Total number of iterations executed (not counting the terminal turn). */
  readonly totalSteps: number;
  /** Ordered record of each intermediate tool-call iteration. */
  readonly steps: readonly LoopStep[];
}
