// src/auth/rate-limiting.ts - PROPERLY FIXED VERSION
import rateLimit from 'express-rate-limit';

// Import the ipKeyGenerator helper to properly handle IPv6 addresses
const { ipKeyGenerator } = require('express-rate-limit');

export class RateLimitService {
  static getAuthLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Limit each IP to 5 requests per windowMs
      message: 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  static getGeneralLimiter() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // Limit each IP to 60 requests per minute
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  static getGraphQLLimiter() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // Limit each IP to 100 GraphQL requests per minute
      message: 'Too many GraphQL requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use the proper IP key generator
        const userId = (req as any).user?.id;
        if (userId) {
          return `user:${userId}`;
        }
        // Use the built-in IP key generator to properly handle IPv6
        return ipKeyGenerator(req);
      },
    });
  }

  // Remove Redis-related methods if not using Redis
  static initializeRedis() {
    console.log('Using memory store for rate limiting');
  }

  static async shutdown() {
    console.log('Rate limiting service shut down');
  }
}