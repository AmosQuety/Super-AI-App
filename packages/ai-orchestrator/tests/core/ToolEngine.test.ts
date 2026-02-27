import { ToolEngine } from '../../core/tools/ToolEngine';
import { ToolRegistry } from '../../core/tools/ToolRegistry';
import type { ToolCall } from '../../core/tools/ToolCall';
import type { ToolDefinition } from '../../core/tools/ToolDefinition';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCall(name: string, id = 'call-1'): ToolCall {
  return Object.freeze({ id, name, arguments: {} });
}

function makeTool(
  name: string,
  handler: (args: Record<string, unknown>) => Promise<unknown> = async () => `result of ${name}`,
): ToolDefinition {
  return { name, description: `Tool: ${name}`, parameters: {}, handler };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToolEngine', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ── Single tool call ───────────────────────────────────────────────────────

  it('executes a single registered tool and returns its result', async () => {
    registry.register(makeTool('get_weather', async () => ({ temp: 22 })));
    const engine = new ToolEngine(registry, 5_000);

    const results = await engine.executeAll([makeCall('get_weather')]);

    expect(results).toHaveLength(1);
    expect(results[0].isError).toBe(false);
    expect(results[0].toolName).toBe('get_weather');
    expect(results[0].content).toBe(JSON.stringify({ temp: 22 }));
  });

  // ── Multiple tool calls (parallel) ────────────────────────────────────────

  it('executes multiple tools and returns results in call order', async () => {
    registry.register(makeTool('tool_a', async () => 'A'));
    registry.register(makeTool('tool_b', async () => 'B'));
    registry.register(makeTool('tool_c', async () => 'C'));

    const engine = new ToolEngine(registry, 5_000);
    const calls = [makeCall('tool_a', 'id-1'), makeCall('tool_b', 'id-2'), makeCall('tool_c', 'id-3')];

    const results = await engine.executeAll(calls);

    expect(results).toHaveLength(3);
    expect(results[0].toolCallId).toBe('id-1');
    expect(results[1].toolCallId).toBe('id-2');
    expect(results[2].toolCallId).toBe('id-3');
    expect(results[0].content).toBe('A');
    expect(results[1].content).toBe('B');
    expect(results[2].content).toBe('C');
  });

  // ── Unknown tool (error result, no throw) ─────────────────────────────────

  it('produces an error ToolResult for an unregistered tool — does not throw', async () => {
    const engine = new ToolEngine(registry, 5_000);
    const results = await engine.executeAll([makeCall('nonexistent')]);

    expect(results).toHaveLength(1);
    expect(results[0].isError).toBe(true);
    expect(results[0].content).toContain('nonexistent');
  });

  // ── Mixed registered + unregistered ───────────────────────────────────────

  it('handles mixed registered and unregistered tools in a single batch', async () => {
    registry.register(makeTool('known_tool', async () => 'known'));
    const engine = new ToolEngine(registry, 5_000);

    const results = await engine.executeAll([
      makeCall('known_tool', 'id-known'),
      makeCall('unknown_tool', 'id-unknown'),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].isError).toBe(false);
    expect(results[0].content).toBe('known');
    expect(results[1].isError).toBe(true);
  });

  // ── Handler failure produces error result ─────────────────────────────────

  it('produces an error result when a registered tool handler throws', async () => {
    registry.register({
      name: 'bad_tool',
      description: 'always fails',
      parameters: {},
      handler: async () => { throw new Error('handler boom'); },
    });
    const engine = new ToolEngine(registry, 5_000);

    const results = await engine.executeAll([makeCall('bad_tool')]);
    expect(results[0].isError).toBe(true);
    expect(results[0].content).toContain('handler boom');
  });

  // ── Empty call list ───────────────────────────────────────────────────────

  it('returns an empty array when given no calls', async () => {
    const engine = new ToolEngine(registry, 5_000);
    const results = await engine.executeAll([]);
    expect(results).toEqual([]);
  });

  // ── Arguments forwarded ───────────────────────────────────────────────────

  it('forwards call arguments to the handler', async () => {
    const received: Record<string, unknown>[] = [];
    registry.register({
      name: 'echo',
      description: 'echoes args',
      parameters: {},
      handler: async (args) => { received.push(args); return args; },
    });
    const engine = new ToolEngine(registry, 5_000);
    const call: ToolCall = Object.freeze({ id: 'id-1', name: 'echo', arguments: { msg: 'hello' } });

    await engine.executeAll([call]);
    expect(received[0]).toEqual({ msg: 'hello' });
  });
});
