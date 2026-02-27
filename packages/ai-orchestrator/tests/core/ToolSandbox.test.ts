import { ToolSandbox } from '../../core/tools/ToolSandbox';
import { ToolTimeoutError } from '../../core/tools/ToolErrors';
import type { ToolDefinition } from '../../core/tools/ToolDefinition';
import type { ToolCall } from '../../core/tools/ToolCall';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return Object.freeze({
    id: 'call-1',
    name: 'test_tool',
    arguments: {},
    ...overrides,
  });
}

function makeDefinition(
  handler: (args: Record<string, unknown>) => Promise<unknown>,
): ToolDefinition {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {},
    handler,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToolSandbox', () => {
  // ── Success path ──────────────────────────────────────────────────────────

  it('returns a successful ToolResult with serialised value', async () => {
    const sandbox = new ToolSandbox(5_000);
    const definition = makeDefinition(async () => ({ temperature: 22, unit: 'C' }));
    const result = await sandbox.execute(makeCall(), definition);

    expect(result.isError).toBe(false);
    expect(result.toolCallId).toBe('call-1');
    expect(result.toolName).toBe('test_tool');
    expect(result.content).toBe(JSON.stringify({ temperature: 22, unit: 'C' }));
  });

  it('passes arguments to the handler', async () => {
    const sandbox = new ToolSandbox(5_000);
    const receivedArgs: Record<string, unknown>[] = [];
    const definition = makeDefinition(async (args) => {
      receivedArgs.push(args);
      return 'ok';
    });

    const call = makeCall({ arguments: { location: 'London' } });
    await sandbox.execute(call, definition);
    expect(receivedArgs[0]).toEqual({ location: 'London' });
  });

  it('serialises a string result without extra JSON quotes', async () => {
    const sandbox = new ToolSandbox(5_000);
    const definition = makeDefinition(async () => 'plain string');
    const result = await sandbox.execute(makeCall(), definition);

    expect(result.content).toBe('plain string');
    expect(result.isError).toBe(false);
  });

  // ── Error capture ─────────────────────────────────────────────────────────

  it('captures handler errors and returns an error ToolResult — never throws', async () => {
    const sandbox = new ToolSandbox(5_000);
    const definition = makeDefinition(async () => {
      throw new Error('handler exploded');
    });

    const result = await sandbox.execute(makeCall(), definition);
    expect(result.isError).toBe(true);
    expect(result.content).toContain('handler exploded');
  });

  it('captures non-Error thrown values', async () => {
    const sandbox = new ToolSandbox(5_000);
    const definition = makeDefinition(async () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    const result = await sandbox.execute(makeCall(), definition);
    expect(result.isError).toBe(true);
  });

  it('error result includes error name and message in content', async () => {
    const sandbox = new ToolSandbox(5_000);
    const definition = makeDefinition(async () => {
      throw new TypeError('bad type');
    });

    const result = await sandbox.execute(makeCall(), definition);
    const parsed = JSON.parse(result.content);
    expect(parsed.error).toBe('TypeError');
    expect(parsed.message).toBe('bad type');
  });

  // ── Timeout enforcement ───────────────────────────────────────────────────

  it('produces an error result when handler exceeds timeoutMs', async () => {
    jest.useFakeTimers();

    const sandbox = new ToolSandbox(100);
    const definition = makeDefinition(
      () => new Promise<never>((resolve) => setTimeout(() => resolve(undefined as never), 10_000)),
    );

    const resultPromise = sandbox.execute(makeCall(), definition);

    // Advance time past the timeout
    jest.advanceTimersByTime(200);
    const result = await resultPromise;

    expect(result.isError).toBe(true);
    expect(result.content).toContain('timed out');

    jest.useRealTimers();
  });

  it('timeout result references the correct tool name and call id', async () => {
    jest.useFakeTimers();

    const sandbox = new ToolSandbox(100);
    const definition = makeDefinition(
      () => new Promise<never>((resolve) => setTimeout(() => resolve(undefined as never), 10_000)),
    );

    const call = makeCall({ id: 'call-xyz', name: 'slow_tool' });
    const customDef: ToolDefinition = { ...definition, name: 'slow_tool' };
    const resultPromise = sandbox.execute(call, customDef);

    jest.advanceTimersByTime(200);
    const result = await resultPromise;

    expect(result.toolCallId).toBe('call-xyz');
    expect(result.toolName).toBe('slow_tool');

    jest.useRealTimers();
  });
});
