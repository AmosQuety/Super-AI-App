import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    logger.warn('[redis] REDIS_URL is not defined; cache features are disabled');
}

// Create a robust Redis client that won't crash the app if the connection fails initially
export const redisClient = redisUrl ? new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        // Prevent infinite fast retries from spamming the console
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
}) : null;

if (redisClient) {
    redisClient.on('error', (err) => {
        logger.error('[redis] connection error', { message: err.message });
    });
    
    redisClient.on('connect', () => {
        logger.debug('[redis] connected');
    });
}

// ── Cache helper utilities ─────────────────────────────────────────────────────

/**
 * Default TTL (seconds) for GraphQL response caching.
 * Override via GRAPHQL_CACHE_TTL_SECONDS env var.
 * Service: backend
 * Required: No  |  Default: 30
 */
export const GRAPHQL_CACHE_TTL = parseInt(process.env.GRAPHQL_CACHE_TTL_SECONDS ?? '30', 10);

/** Hash arbitrary input into a short, URL-safe cache key segment. */
export function hashKey(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/** Get a cached value. Returns null if Redis is unavailable or key is missing. */
export async function cacheGet(key: string): Promise<string | null> {
    if (!redisClient) return null;
    try {
        return await redisClient.get(key);
    } catch (err: any) {
        logger.warn('[redis] cacheGet failed', { key, message: err.message });
        return null;
    }
}

/** Set a cached value with TTL in seconds. No-op if Redis is unavailable. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!redisClient) return;
    try {
        await redisClient.set(key, value, 'EX', ttlSeconds);
    } catch (err: any) {
        logger.warn('[redis] cacheSet failed', { key, message: err.message });
    }
}

/** Delete a single cache key. No-op if Redis is unavailable. */
export async function cacheDel(key: string): Promise<void> {
    if (!redisClient) return;
    try {
        await redisClient.del(key);
    } catch (err: any) {
        logger.warn('[redis] cacheDel failed', { key, message: err.message });
    }
}

/**
 * Delete all keys matching a glob pattern using a cursor-based SCAN.
 * Use sparingly — O(N) over matching keys.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
    if (!redisClient) return;
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redisClient.del(...keys);
            }
        } while (cursor !== '0');
    } catch (err: any) {
        logger.warn('[redis] cacheDelPattern failed', { pattern, message: err.message });
    }
}
