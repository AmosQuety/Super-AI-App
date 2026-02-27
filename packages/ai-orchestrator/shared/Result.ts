/**
 * A discriminated union that explicitly models success and failure outcomes
 * without resorting to thrown exceptions for expected failure paths.
 *
 * Use `Result<T, E>` to represent operations that can fail in anticipated ways
 * (e.g. registry lookups, routing decisions), and let exceptions propagate
 * only for truly unexpected errors.
 *
 * @example
 * ```ts
 * function findProvider(id: string): Result<IProvider, ProviderNotFoundError> {
 *   const found = registry.get(id);
 *   if (!found) return err(new ProviderNotFoundError(id));
 *   return ok(found);
 * }
 *
 * const result = findProvider('openai');
 * if (result.ok) {
 *   result.value.complete(...);
 * } else {
 *   // result.error is ProviderNotFoundError
 * }
 * ```
 */
export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Constructs a successful {@link Result}.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Constructs a failed {@link Result}.
 */
export function err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
