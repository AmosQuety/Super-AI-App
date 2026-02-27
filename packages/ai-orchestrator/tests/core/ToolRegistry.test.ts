import { ToolRegistry } from '../../core/tools/ToolRegistry';
import { ToolNotFoundError, DuplicateToolError } from '../../core/tools/ToolErrors';
import type { ToolDefinition } from '../../core/tools/ToolDefinition';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTool(name: string, description = 'A test tool'): ToolDefinition {
  return {
    name,
    description,
    parameters: { type: 'object', properties: {} },
    handler: async (_args) => `result from ${name}`,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ── register ───────────────────────────────────────────────────────────────

  it('registers a tool without error', () => {
    expect(() => registry.register(makeTool('get_weather'))).not.toThrow();
  });

  it('throws DuplicateToolError when the same name is registered twice', () => {
    registry.register(makeTool('get_weather'));
    expect(() => registry.register(makeTool('get_weather'))).toThrow(DuplicateToolError);
  });

  it('DuplicateToolError carries the tool name', () => {
    registry.register(makeTool('get_weather'));
    try {
      registry.register(makeTool('get_weather'));
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateToolError);
      expect((e as DuplicateToolError).toolName).toBe('get_weather');
    }
  });

  it('registers multiple tools with distinct names', () => {
    registry.register(makeTool('tool_a'));
    registry.register(makeTool('tool_b'));
    registry.register(makeTool('tool_c'));
    expect(registry.list()).toHaveLength(3);
  });

  // ── get ────────────────────────────────────────────────────────────────────

  it('retrieves a registered tool by name', () => {
    const tool = makeTool('get_weather');
    registry.register(tool);
    expect(registry.get('get_weather')).toBe(tool);
  });

  it('throws ToolNotFoundError for an unregistered name', () => {
    expect(() => registry.get('nonexistent')).toThrow(ToolNotFoundError);
  });

  it('ToolNotFoundError carries the requested tool name', () => {
    try {
      registry.get('nonexistent');
    } catch (e) {
      expect(e).toBeInstanceOf(ToolNotFoundError);
      expect((e as ToolNotFoundError).toolName).toBe('nonexistent');
    }
  });

  // ── list ───────────────────────────────────────────────────────────────────

  it('list() returns an empty array when nothing is registered', () => {
    expect(registry.list()).toEqual([]);
  });

  it('list() returns tools in insertion order', () => {
    registry.register(makeTool('tool_a'));
    registry.register(makeTool('tool_b'));
    const names = registry.list().map((t) => t.name);
    expect(names).toEqual(['tool_a', 'tool_b']);
  });

  it('list() returns a frozen array (immutable snapshot)', () => {
    registry.register(makeTool('tool_a'));
    const result = registry.list();
    expect(Object.isFrozen(result)).toBe(true);
  });
});
