/**
 * apolloCachePlugin.ts
 *
 * Short-TTL server-side response cache for read-heavy, stable GraphQL operations.
 *
 * Cache key format: cache:<userId>:<operationName>:<hash(variables)>
 *
 * Cached operations (reads only — mutations are never cached):
 *   - GetChats
 *   - myWorkspaces
 *   - GetDocumentLifecycle
 *
 * The plugin hooks into the Apollo lifecycle:
 *   requestDidStart → responseForOperation (cache HIT — return early, skip resolvers)
 *   requestDidStart → willSendResponse     (cache MISS — populate cache after resolver runs)
 *
 * Cache invalidation:
 *   Call invalidateUserCache(userId, operationName?) to bust cache keys for a user.
 *   This is called by mutations that affect the cached data (e.g. createChat busts GetChats).
 */

import { ApolloServerPlugin, GraphQLRequestContext } from 'apollo-server-plugin-base';
import { GraphQLResponse } from 'apollo-server-types';
import { cacheGet, cacheSet, cacheDelPattern, GRAPHQL_CACHE_TTL, hashKey } from '../lib/redis';
import { logger } from './logger';

// Operations eligible for caching (reads only)
const CACHEABLE_OPERATIONS = new Set([
  'GetChats',
  'myWorkspaces',
  'GetDocumentLifecycle',
]);

// Extract userId from Apollo context (matches the createContext() shape)
function getUserId(context: any): string | null {
  return context?.user?.id ?? null;
}

// Build the Redis cache key for a given request
function buildCacheKey(userId: string, operationName: string, variables: Record<string, any>): string {
  const varHash = hashKey(JSON.stringify(variables ?? {}));
  return `cache:${userId}:${operationName}:${varHash}`;
}

/**
 * Bust all cached responses for a given user and optional operation.
 * Pass operationName to bust a single operation; omit to bust all cached ops for user.
 *
 * Usage:
 *   await invalidateUserCache(userId, 'GetChats');    // bust only GetChats
 *   await invalidateUserCache(userId);                // bust everything for user
 */
export async function invalidateUserCache(userId: string, operationName?: string): Promise<void> {
  const pattern = operationName
    ? `cache:${userId}:${operationName}:*`
    : `cache:${userId}:*`;
  await cacheDelPattern(pattern);
  logger.debug('[apollo-cache] invalidated', { userId, operationName: operationName ?? 'ALL' });
}

export const apolloCachePlugin: ApolloServerPlugin = {
  async requestDidStart(requestContext: GraphQLRequestContext): Promise<any> {
    const { request, context } = requestContext;
    const operationName = request.operationName ?? '';

    // Determine if this request is a mutation — mutations are never cached
    const isMutation = (request.query ?? '').trimStart().startsWith('mutation');

    // Only cache explicitly listed read operations
    if (isMutation || !CACHEABLE_OPERATIONS.has(operationName)) {
      return {};
    }

    const userId = getUserId(context);
    if (!userId) return {}; // Unauthenticated — skip cache

    const cacheKey = buildCacheKey(userId, operationName, request.variables ?? {});

    return {
      // ── Cache HIT path ──────────────────────────────────────────────────
      async responseForOperation(): Promise<GraphQLResponse | null> {
        const cached = await cacheGet(cacheKey);
        if (!cached) return null; // Cache miss — proceed to resolvers

        try {
          const parsed = JSON.parse(cached);
          logger.debug('[apollo-cache] HIT', { operationName, userId });
          return parsed as GraphQLResponse;
        } catch {
          return null; // Corrupt cache entry — proceed to resolvers
        }
      },

      // ── Cache MISS path — populate after resolver completes ─────────────
      async willSendResponse(responseContext: GraphQLRequestContext): Promise<void> {
        const { response } = responseContext;

        // Only cache successful responses with data
        if (!response?.data || response.errors?.length) return;

        try {
          await cacheSet(cacheKey, JSON.stringify(response), GRAPHQL_CACHE_TTL);
          logger.debug('[apollo-cache] SET', { operationName, userId, ttl: GRAPHQL_CACHE_TTL });
        } catch (err: any) {
          logger.warn('[apollo-cache] failed to set cache', { message: err.message });
        }
      },
    };
  },
};
