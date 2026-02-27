/**
 * Thrown by {@link ProviderRegistry} when a requested provider ID
 * has not been registered.
 */
export class ProviderNotFoundError extends Error {
  /** The provider ID that could not be resolved. */
  readonly providerId: string;

  constructor(providerId: string) {
    super(`Provider not found: "${providerId}"`);
    this.name = 'ProviderNotFoundError';
    this.providerId = providerId;

    // Maintains proper prototype chain in transpiled ES5+ environments.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by {@link ProviderRegistry} when attempting to register a provider
 * whose ID is already present in the registry.
 */
export class DuplicateProviderError extends Error {
  /** The provider ID that conflicted. */
  readonly providerId: string;

  constructor(providerId: string) {
    super(`Provider already registered: "${providerId}"`);
    this.name = 'DuplicateProviderError';
    this.providerId = providerId;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
