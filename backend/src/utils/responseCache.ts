// src/utils/responseCache.ts
import NodeCache from 'node-cache';
import {logger} from './logger'; 

export class ResponseCache {
  private static instance: NodeCache;

  static getInstance(): NodeCache {
    if (!this.instance) {
      this.instance = new NodeCache({
        stdTTL: 300, // 5 minutes default
        checkperiod: 60, // Check for expired keys every minute
        useClones: false // Better performance
      });
    }
    return this.instance;
  }

  static async getOrSet<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.getInstance().get<T>(key);
    if (cached !== undefined) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    logger.debug('Cache miss', { key });
    const result = await fetchFunction();
    if (ttl !== undefined) {
      this.getInstance().set(key, result, ttl);
    } else {
      this.getInstance().set(key, result);
    }
    return result;
  }

  static invalidatePattern(pattern: string) {
    const keys = this.getInstance().keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    matchingKeys.forEach(key => this.getInstance().del(key));
    logger.debug('Cache invalidated', { pattern, keys: matchingKeys });
  }
}