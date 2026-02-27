import { ProviderRegistry } from '../../core/registry/ProviderRegistry';
import {
  DuplicateProviderError,
  ProviderNotFoundError,
} from '../../core/registry/ProviderRegistryErrors';
import type { IProvider } from '../../core/ports/IProvider';
import type { ProviderCapabilities } from '../../core/entities/ProviderCapabilities';
import type { ChatMessage } from '../../core/entities/ChatMessage';
import type { CompletionOptions } from '../../core/entities/CompletionOptions';
import type { FinalResponse } from '../../core/entities/FinalResponse';
import type { StreamResponse } from '../../core/entities/StreamResponse';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCapabilities(overrides?: Partial<ProviderCapabilities>): ProviderCapabilities {
  return {
    supportsStreaming: true,
    supportsSystemPrompt: true,
    maxContextTokens: 128_000,
    supportedModels: ['test-model-1'],
    ...overrides,
  };
}

function makeProvider(id: string, capabilities?: Partial<ProviderCapabilities>): IProvider {
  return {
    id,
    capabilities: makeCapabilities(capabilities),

    complete(_messages: readonly ChatMessage[], _options: CompletionOptions): Promise<FinalResponse> {
      return Promise.reject(new Error('Not implemented in test stub'));
    },

    // eslint-disable-next-line require-yield
    async *stream(_messages: readonly ChatMessage[], _options: CompletionOptions): AsyncIterable<StreamResponse> {
      throw new Error('Not implemented in test stub');
    },

    healthCheck(): Promise<boolean> {
      return Promise.resolve(true);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('registers a new provider successfully', () => {
      const provider = makeProvider('openai');
      registry.register(provider);
      expect(registry.has('openai')).toBe(true);
    });

    it('increments size after registration', () => {
      registry.register(makeProvider('openai'));
      registry.register(makeProvider('gemini'));
      expect(registry.size).toBe(2);
    });

    it('throws DuplicateProviderError when registering the same ID twice', () => {
      registry.register(makeProvider('openai'));
      expect(() => registry.register(makeProvider('openai'))).toThrow(DuplicateProviderError);
    });

    it('thrown DuplicateProviderError carries the conflicting provider ID', () => {
      registry.register(makeProvider('openai'));
      try {
        registry.register(makeProvider('openai'));
        fail('Expected DuplicateProviderError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DuplicateProviderError);
        expect((e as DuplicateProviderError).providerId).toBe('openai');
      }
    });
  });

  // ── get ───────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('retrieves a registered provider by ID', () => {
      const provider = makeProvider('openai');
      registry.register(provider);
      expect(registry.get('openai')).toBe(provider);
    });

    it('throws ProviderNotFoundError for an unregistered ID', () => {
      expect(() => registry.get('nonexistent')).toThrow(ProviderNotFoundError);
    });

    it('thrown ProviderNotFoundError carries the missing provider ID', () => {
      try {
        registry.get('nonexistent');
        fail('Expected ProviderNotFoundError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderNotFoundError);
        expect((e as ProviderNotFoundError).providerId).toBe('nonexistent');
      }
    });
  });

  // ── unregister ────────────────────────────────────────────────────────────

  describe('unregister()', () => {
    it('removes a registered provider', () => {
      registry.register(makeProvider('openai'));
      registry.unregister('openai');
      expect(registry.has('openai')).toBe(false);
    });

    it('decrements size after unregistration', () => {
      registry.register(makeProvider('openai'));
      registry.register(makeProvider('gemini'));
      registry.unregister('openai');
      expect(registry.size).toBe(1);
    });

    it('is a no-op when the ID is not registered', () => {
      expect(() => registry.unregister('ghost')).not.toThrow();
      expect(registry.size).toBe(0);
    });

    it('allows re-registering an unregistered provider ID', () => {
      const provider = makeProvider('openai');
      registry.register(provider);
      registry.unregister('openai');
      expect(() => registry.register(makeProvider('openai'))).not.toThrow();
    });
  });

  // ── getAll ────────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns an empty map when no providers are registered', () => {
      expect(registry.getAll().size).toBe(0);
    });

    it('returns all registered providers', () => {
      const p1 = makeProvider('openai');
      const p2 = makeProvider('gemini');
      registry.register(p1);
      registry.register(p2);

      const all = registry.getAll();
      expect(all.size).toBe(2);
      expect(all.get('openai')).toBe(p1);
      expect(all.get('gemini')).toBe(p2);
    });

    it('returns a defensive copy — mutating the result does not affect the registry', () => {
      registry.register(makeProvider('openai'));
      const snapshot = registry.getAll() as Map<string, IProvider>;
      snapshot.delete('openai');

      expect(registry.has('openai')).toBe(true);
    });
  });

  // ── has ───────────────────────────────────────────────────────────────────

  describe('has()', () => {
    it('returns true for a registered provider', () => {
      registry.register(makeProvider('openai'));
      expect(registry.has('openai')).toBe(true);
    });

    it('returns false for an unregistered provider', () => {
      expect(registry.has('openai')).toBe(false);
    });
  });

  // ── size ──────────────────────────────────────────────────────────────────

  describe('size', () => {
    it('starts at 0', () => {
      expect(registry.size).toBe(0);
    });

    it('reflects current registered count accurately', () => {
      registry.register(makeProvider('a'));
      registry.register(makeProvider('b'));
      registry.register(makeProvider('c'));
      registry.unregister('b');
      expect(registry.size).toBe(2);
    });
  });
});
