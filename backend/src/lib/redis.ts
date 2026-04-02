import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.warn("⚠️ REDIS_URL is not defined in .env. Redis functionality will be disabled.");
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
        console.error("🔴 Redis Connection Error. Please verify your REDIS_URL password in .env!", err.message);
    });
    
    redisClient.on('connect', () => {
        console.log("🟢 Redis Connected Successfully!");
    });
}
