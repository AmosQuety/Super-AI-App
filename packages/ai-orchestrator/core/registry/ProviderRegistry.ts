import type { IProvider } from '../ports/IProvider.js';
import {
  DuplicateProviderError,
  ProviderNotFoundError,
} from './ProviderRegistryErrors.js';

/**
 * In-memory registry of {@link IProvider} instances.
 *
 * Responsibilities (CRUD only — no business logic):
 *   - Store and retrieve provider instances by ID.
 *   - Enforce uniqueness of provider IDs.
 *   - Expose a read-only view of all registered providers.
 *
 * The registry is intentionally stateful and synchronous; all complexity
 * around routing, fallback, and selection lives in {@link IRouter} adapters.
 *
 * @example
 * ```ts
 * const registry = new ProviderRegistry();
 * registry.register(openAiAdapter);
 * registry.register(geminiAdapter);
 *
 * const provider = registry.get('openai');
 * const all = registry.getAll(); // ReadonlyMap<string, IProvider>
 * ```
 */
export class ProviderRegistry {
  private readonly providers: Map<string, IProvider>;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Registers a provider in the registry.
   *
   * @param provider - The provider adapter to register.
   * @throws {DuplicateProviderError} if a provider with the same ID already exists.
   */
  register(provider: IProvider): void {
    if (this.providers.has(provider.id)) {
      throw new DuplicateProviderError(provider.id);
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Removes a provider from the registry.
   * No-op if the provider was not registered.
   *
   * @param id - The provider ID to unregister.
   */
  unregister(id: string): void {
    this.providers.delete(id);
  }

  /**
   * Retrieves a registered provider by ID.
   *
   * @param id - The provider ID to look up.
   * @returns The matching {@link IProvider}.
   * @throws {ProviderNotFoundError} if no provider with this ID is registered.
   */
  get(id: string): IProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }
    return provider;
  }

  /**
   * Returns a read-only snapshot of all registered providers.
   * Mutations to the returned map have no effect on the registry.
   */
  getAll(): ReadonlyMap<string, IProvider> {
    return new Map(this.providers);
  }

  /**
   * Checks whether a provider with the given ID is registered.
   *
   * @param id - The provider ID to check.
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Returns the number of registered providers.
   */
  get size(): number {
    return this.providers.size;
  }
}
