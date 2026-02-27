/**
 * Thrown when every provider in the primary + fallback chain has been
 * attempted and all have failed.
 */
export class AllProvidersFailedError extends Error {
  /** IDs of all providers that were attempted before giving up. */
  readonly attemptedProviderIds: readonly string[];
  /** The last error encountered in the chain. */
  readonly lastError: Error;

  constructor(attemptedProviderIds: readonly string[], lastError: Error) {
    super(
      `All providers failed. Attempted: [${attemptedProviderIds.join(', ')}]. ` +
      `Last error: ${lastError.message}`,
    );
    this.name = 'AllProvidersFailedError';
    this.attemptedProviderIds = attemptedProviderIds;
    this.lastError = lastError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the router cannot resolve any provider before an attempt
 * is even made (e.g. registry is empty, all circuits open, no capabilities match).
 */
export class NoRouteFoundError extends Error {
  constructor(reason: string) {
    super(`No route found: ${reason}`);
    this.name = 'NoRouteFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
