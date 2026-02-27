import type { IProvider } from '../ports/IProvider.js';
import type { IToolRegistry } from '../ports/IToolRegistry.js';
import type { ChatMessage } from '../entities/ChatMessage.js';
import type { CompletionOptions } from '../entities/CompletionOptions.js';
import type { FinalResponse } from '../entities/FinalResponse.js';
import type { ToolCall } from './ToolCall.js';
import type { ToolResult } from './ToolResult.js';
import type { ToolLoopConfig } from './ToolLoopConfig.js';
import type { LoopTrace, LoopStep } from './LoopTrace.js';
import { ToolEngine } from './ToolEngine.js';
import { MaxLoopsExceededError } from './ToolErrors.js';

/**
 * Drives the full agentic, multi-step reasoning loop.
 *
 * ## Loop invariant
 * ```
 * while steps < config.maxLoops:
 *   response = provider.complete(messages, options)
 *   if response.finishReason !== 'tool_calls' → return { response, trace }
 *   results  = toolEngine.executeAll(response.toolCalls)
 *   messages = [...messages, assistantTurn, ...toolResultTurns]
 *   steps++
 * throw MaxLoopsExceededError
 * ```
 *
 * ## Message stream contract
 * After each model turn that requests tool calls, two types of turns are
 * appended to the running message list:
 * 1. An **assistant turn** whose `metadata.toolCalls` carries the raw
 *    {@link ToolCall} array (so the model has context on what it requested).
 * 2. One **tool turn** per result, with `role: 'tool'` and `metadata.toolCallId`.
 *
 * The message list is built immutably — each iteration produces a new array.
 *
 * ## Observability
 * The loop produces a {@link LoopTrace} on both success and `MaxLoopsExceededError`,
 * accessible via the trace returned alongside the final {@link FinalResponse}.
 */
export class ToolLoop {
  private readonly engine: ToolEngine;

  /**
   * @param provider  - The provider to use for each completion turn.
   * @param registry  - Registry from which tool handlers are resolved.
   * @param config    - Max loop limit and per-tool timeout.
   */
  constructor(
    private readonly provider: IProvider,
    private readonly registry: IToolRegistry,
    private readonly config: ToolLoopConfig,
  ) {
    this.engine = new ToolEngine(registry, config.toolTimeoutMs);
  }

  /**
   * Runs the agentic loop until the model produces a terminal response or
   * the loop limit is reached.
   *
   * @param messages - Initial message history (not mutated).
   * @param options  - Completion options forwarded to the provider each turn.
   * @returns The terminal {@link FinalResponse} and the {@link LoopTrace}.
   * @throws {MaxLoopsExceededError} if `config.maxLoops` is exhausted.
   */
  async run(
    messages: readonly ChatMessage[],
    options: CompletionOptions,
  ): Promise<{ response: FinalResponse; trace: LoopTrace }> {
    let currentMessages: readonly ChatMessage[] = messages;
    const steps: LoopStep[] = [];

    for (let step = 0; step < this.config.maxLoops; step++) {
      const response = await this.provider.complete(currentMessages, options);

      // Terminal state — model produced a real answer (or hit length/filter)
      if (response.finishReason !== 'tool_calls' || !response.toolCalls?.length) {
        const trace: LoopTrace = Object.freeze({
          totalSteps: steps.length,
          steps: Object.freeze(steps),
        });
        return { response, trace };
      }

      // Execute all tool calls for this turn
      const toolCalls = response.toolCalls;
      const toolResults = await this.engine.executeAll(toolCalls);

      // Record this step
      const loopStep: LoopStep = Object.freeze({
        stepIndex: step + 1,
        toolCalls: Object.freeze(toolCalls),
        toolResults: Object.freeze(toolResults),
      });
      steps.push(loopStep);

      // Append new turns to the message stream
      currentMessages = [
        ...currentMessages,
        this.buildAssistantTurn(response.id, toolCalls),
        ...this.buildToolResultTurns(toolResults),
      ];
    }

    // If we exit the loop without a terminal response, it's an overflow
    throw new MaxLoopsExceededError(this.config.maxLoops);
  }

  // ── Private message builders ───────────────────────────────────────────────

  /**
   * Builds the assistant turn that represents the model's tool-call request.
   * The raw tool calls are stored in `metadata` so providers and context
   * builders can access them without parsing message content.
   */
  private buildAssistantTurn(
    responseId: string,
    toolCalls: readonly ToolCall[],
  ): ChatMessage {
    return Object.freeze({
      id: responseId,
      role: 'assistant' as const,
      // Content is intentionally empty — the model's "message" for a tool turn
      // is carried via toolCalls metadata, not the content field.
      content: '',
      createdAt: new Date().toISOString(),
      metadata: Object.freeze({ toolCalls: toolCalls as unknown }),
    });
  }

  /**
   * Builds one message turn per tool result using the canonical `tool` role.
   * Each turn references its source call via `metadata.toolCallId`.
   */
  private buildToolResultTurns(results: readonly ToolResult[]): ChatMessage[] {
    return results.map((result) =>
      Object.freeze({
        id: crypto.randomUUID(),
        role: 'tool' as const,
        content: result.content,
        createdAt: new Date().toISOString(),
        metadata: Object.freeze({
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          isError: result.isError,
        }),
      }),
    );
  }
}
