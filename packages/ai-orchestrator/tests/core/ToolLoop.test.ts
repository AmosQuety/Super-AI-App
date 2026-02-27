import { ToolLoop } from '../../core/tools/ToolLoop';
import { ToolRegistry } from '../../core/tools/ToolRegistry';
import { MaxLoopsExceededError } from '../../core/tools/ToolErrors';
import { createToolLoopConfig } from '../../core/tools/ToolLoopConfig';
import type { IProvider } from '../../core/ports/IProvider';
import type { ChatMessage } from '../../core/entities/ChatMessage';
import type { CompletionOptions } from '../../core/entities/CompletionOptions';
import type { FinalResponse } from '../../core/entities/FinalResponse';
import type { StreamResponse } from '../../core/entities/StreamResponse';
import type { ToolCall } from '../../core/tools/ToolCall';
import { createTokenUsage } from '../../core/entities/TokenUsage';
import type { ToolDefinition } from '../../core/tools/ToolDefinition';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFinalResponse(overrides: Partial<FinalResponse> = {}): FinalResponse {
  return {
    id: 'resp-1',
    content: 'Done.',
    model: 'test-model',
    provider: 'test-provider',
    usage: createTokenUsage(10, 20),
    finishReason: 'stop',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeToolCallResponse(toolCalls: ToolCall[]): FinalResponse {
  return makeFinalResponse({ finishReason: 'tool_calls', content: '', toolCalls });
}

/** Creates a provider that returns responses from a predefined queue. */
function makeSequentialProvider(responses: FinalResponse[]): IProvider {
  let index = 0;
  return {
    id: 'test-provider',
    capabilities: {
      supportsStreaming: false,
      supportsSystemPrompt: true,
      maxContextTokens: 128_000,
      supportedModels: [],
    },
    complete: jest.fn(async () => {
      const resp = responses[index++];
      if (resp === undefined) throw new Error('No more queued responses');
      return resp;
    }),
    stream: (): AsyncIterable<StreamResponse> => { throw new Error('not impl'); },
    healthCheck: () => Promise.resolve(true),
  };
}

function makeWeatherTool(): ToolDefinition {
  return {
    name: 'get_weather',
    description: 'Gets the weather',
    parameters: { type: 'object', properties: { location: { type: 'string' } } },
    handler: async (args) => ({ location: (args as { location: string }).location, temp: 22 }),
  };
}

const BASE_MESSAGES: readonly ChatMessage[] = [];
const BASE_OPTIONS: CompletionOptions = {};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToolLoop', () => {
  let registry: ToolRegistry;
  const DEFAULT_CONFIG = createToolLoopConfig({ maxLoops: 5, toolTimeoutMs: 5_000 });

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(makeWeatherTool());
  });

  // ── Single-step resolution (no tool calls) ─────────────────────────────────

  it('returns immediately when the first response has no tool calls', async () => {
    const terminalResponse = makeFinalResponse({ content: 'Paris is sunny.' });
    const provider = makeSequentialProvider([terminalResponse]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    const { response, trace } = await loop.run(BASE_MESSAGES, BASE_OPTIONS);

    expect(response.content).toBe('Paris is sunny.');
    expect(response.finishReason).toBe('stop');
    expect(trace.totalSteps).toBe(0);
    expect(trace.steps).toHaveLength(0);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('returns immediately when finishReason is stop regardless of toolCalls field', async () => {
    // Even if toolCalls is accidentally set with stop reason, we stop
    const response = makeFinalResponse({ finishReason: 'stop' });
    const provider = makeSequentialProvider([response]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    const { trace } = await loop.run(BASE_MESSAGES, BASE_OPTIONS);
    expect(trace.totalSteps).toBe(0);
  });

  // ── Single-step tool call ─────────────────────────────────────────────────

  it('executes one tool call and then returns the terminal response', async () => {
    const toolCallResp = makeToolCallResponse([
      { id: 'call-1', name: 'get_weather', arguments: { location: 'Paris' } },
    ]);
    const terminalResp = makeFinalResponse({ content: 'It is 22°C in Paris.' });

    const provider = makeSequentialProvider([toolCallResp, terminalResp]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    const { response, trace } = await loop.run(BASE_MESSAGES, BASE_OPTIONS);

    expect(response.content).toBe('It is 22°C in Paris.');
    expect(trace.totalSteps).toBe(1);
    expect(trace.steps).toHaveLength(1);
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it('appends assistant + tool result turns to the message stream after tool execution', async () => {
    const toolCallResp = makeToolCallResponse([
      { id: 'call-1', name: 'get_weather', arguments: { location: 'Tokyo' } },
    ]);
    const terminalResp = makeFinalResponse({ content: 'It is warm in Tokyo.' });

    const provider = makeSequentialProvider([toolCallResp, terminalResp]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    await loop.run(BASE_MESSAGES, BASE_OPTIONS);

    // Second call should receive original messages + assistant turn + tool result turn
    const secondCallArgs = (provider.complete as jest.Mock).mock.calls[1][0] as ChatMessage[];
    expect(secondCallArgs.length).toBeGreaterThanOrEqual(2);

    const assistantTurn = secondCallArgs.find((m) => m.role === 'assistant');
    const toolTurn = secondCallArgs.find((m) => m.role === 'tool');
    expect(assistantTurn).toBeDefined();
    expect(toolTurn).toBeDefined();
    expect(toolTurn?.metadata?.toolCallId).toBe('call-1');
  });

  // ── Multi-step tool calls ──────────────────────────────────────────────────

  it('handles multiple sequential tool-call steps before terminal response', async () => {
    registry.register({
      name: 'get_forecast',
      description: 'Gets a forecast',
      parameters: {},
      handler: async () => ({ forecast: 'sunny' }),
    });

    const step1 = makeToolCallResponse([
      { id: 'call-1', name: 'get_weather', arguments: { location: 'London' } },
    ]);
    const step2 = makeToolCallResponse([
      { id: 'call-2', name: 'get_forecast', arguments: {} },
    ]);
    const terminal = makeFinalResponse({ content: 'London will be sunny.' });

    const provider = makeSequentialProvider([step1, step2, terminal]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    const { trace } = await loop.run(BASE_MESSAGES, BASE_OPTIONS);
    expect(trace.totalSteps).toBe(2);
    expect(trace.steps[0].stepIndex).toBe(1);
    expect(trace.steps[1].stepIndex).toBe(2);
    expect(provider.complete).toHaveBeenCalledTimes(3);
  });

  // ── Loop trace correctness ─────────────────────────────────────────────────

  it('trace step records the correct tool calls and results', async () => {
    const toolCallResp = makeToolCallResponse([
      { id: 'call-99', name: 'get_weather', arguments: { location: 'Berlin' } },
    ]);
    const terminal = makeFinalResponse({ content: 'Berlin is cold.' });

    const provider = makeSequentialProvider([toolCallResp, terminal]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    const { trace } = await loop.run(BASE_MESSAGES, BASE_OPTIONS);

    const step = trace.steps[0];
    expect(step.stepIndex).toBe(1);
    expect(step.toolCalls).toHaveLength(1);
    expect(step.toolCalls[0].id).toBe('call-99');
    expect(step.toolResults).toHaveLength(1);
    expect(step.toolResults[0].toolCallId).toBe('call-99');
    expect(step.toolResults[0].isError).toBe(false);
  });

  // ── Max loops exceeded ─────────────────────────────────────────────────────

  it('throws MaxLoopsExceededError when the model never stops requesting tools', async () => {
    const responses = Array.from({ length: 20 }, (_, i) =>
      makeToolCallResponse([
        { id: `call-${i}`, name: 'get_weather', arguments: { location: 'Loop' } },
      ]),
    );

    const config = createToolLoopConfig({ maxLoops: 3, toolTimeoutMs: 5_000 });
    const provider = makeSequentialProvider(responses);
    const loop = new ToolLoop(provider, registry, config);

    await expect(loop.run(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow(MaxLoopsExceededError);
  });

  it('MaxLoopsExceededError reports the configured limit', async () => {
    const responses = Array.from({ length: 20 }, (_, i) =>
      makeToolCallResponse([{ id: `c-${i}`, name: 'get_weather', arguments: { location: 'X' } }]),
    );
    const config = createToolLoopConfig({ maxLoops: 2, toolTimeoutMs: 5_000 });
    const provider = makeSequentialProvider(responses);
    const loop = new ToolLoop(provider, registry, config);

    try {
      await loop.run(BASE_MESSAGES, BASE_OPTIONS);
    } catch (e) {
      expect(e).toBeInstanceOf(MaxLoopsExceededError);
      expect((e as MaxLoopsExceededError).maxLoops).toBe(2);
    }
  });

  it('executes exactly maxLoops provider calls before throwing', async () => {
    const responses = Array.from({ length: 20 }, (_, i) =>
      makeToolCallResponse([{ id: `c-${i}`, name: 'get_weather', arguments: { location: 'X' } }]),
    );
    const config = createToolLoopConfig({ maxLoops: 4, toolTimeoutMs: 5_000 });
    const provider = makeSequentialProvider(responses);
    const loop = new ToolLoop(provider, registry, config);

    await expect(loop.run(BASE_MESSAGES, BASE_OPTIONS)).rejects.toThrow(MaxLoopsExceededError);
    // 4 calls = 4 tool-call turns (no terminal)
    expect(provider.complete).toHaveBeenCalledTimes(4);
  });

  // ── Tool error in loop (loop continues) ───────────────────────────────────

  it('continues the loop after a tool execution error — model is informed via error result', async () => {
    registry.register({
      name: 'failing_tool',
      description: 'always fails',
      parameters: {},
      handler: async () => { throw new Error('tool broke'); },
    });

    const step1 = makeToolCallResponse([
      { id: 'call-1', name: 'failing_tool', arguments: {} },
    ]);
    const terminal = makeFinalResponse({ content: 'I could not get the data.' });

    const provider = makeSequentialProvider([step1, terminal]);
    const loop = new ToolLoop(provider, registry, DEFAULT_CONFIG);

    const { response, trace } = await loop.run(BASE_MESSAGES, BASE_OPTIONS);

    expect(response.content).toBe('I could not get the data.');
    expect(trace.steps[0].toolResults[0].isError).toBe(true);
    expect(trace.steps[0].toolResults[0].content).toContain('tool broke');
  });

  // ── ToolLoopConfig validation ─────────────────────────────────────────────

  it('createToolLoopConfig throws RangeError for maxLoops < 1', () => {
    expect(() => createToolLoopConfig({ maxLoops: 0 })).toThrow(RangeError);
  });

  it('createToolLoopConfig throws RangeError for toolTimeoutMs < 1', () => {
    expect(() => createToolLoopConfig({ toolTimeoutMs: 0 })).toThrow(RangeError);
  });

  it('createToolLoopConfig applies sensible defaults', () => {
    const config = createToolLoopConfig();
    expect(config.maxLoops).toBe(10);
    expect(config.toolTimeoutMs).toBe(15_000);
  });
});
