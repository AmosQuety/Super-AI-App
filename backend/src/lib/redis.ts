import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';
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
