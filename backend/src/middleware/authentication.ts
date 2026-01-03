// src/middleware/authentication.ts
import prisma from '../lib/db'; // <--- Use Singleton (Fixes connection limit issues)
import { logger } from '../utils/logger';
import { createContext } from '../resolvers/types/context';

/**
 * GraphQL Context Enhancer - Adds additional auth features to your existing context
 */
export class GraphQLAuthEnhancer {
  /**
   * Enhanced context creation with additional security features
   */
  static async createEnhancedContext({ req, connection }: any) {
    const baseContext = await createContext({ req, connection });
    
    return {
      ...baseContext,
      // Additional auth utilities for resolvers
      auth: {
        // Check if user has specific permission
        requirePermission: (_permission: string) => {
          if (!baseContext.user) {
            throw new Error('Authentication required');
          }
          // Add your permission logic here
          return true;
        },
        
        // Get user with fresh data from database
        getFreshUser: async () => {
          if (!baseContext.user) return null;
          return await prisma.user.findUnique({
            // 👇 FIX: Use userId instead of id
            where: { id: baseContext.user.userId },
            select: { id: true, email: true, name: true, role: true, isActive: true }
          });
        },
        
        // Audit log for sensitive operations
        logSecurityEvent: (event: string, details: any) => {
          logger.info('Security Event', {
            event,
            // 👇 FIX: Use userId instead of id
            userId: baseContext.user?.userId,
            ...details,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  /**
   * Rate limiting per user for GraphQL operations
   */
  static createOperationRateLimiter() {
    const userOperationCounts = new Map<string, number>();
    
    return {
      checkRateLimit: (userId: string, operation: string, limit: number = 100): boolean => {
        const key = `${userId}:${operation}`;
        const count = userOperationCounts.get(key) || 0;
        
        if (count >= limit) {
          logger.warn('GraphQL operation rate limit exceeded', { userId, operation, count, limit });
          return false;
        }
        
        userOperationCounts.set(key, count + 1);
        
        // Reset counters periodically
        setTimeout(() => {
          userOperationCounts.delete(key);
        }, 60000); // 1 minute
        
        return true;
      }
    };
  }
}

export const graphQLAuthDirectives = {
  authDirectiveTransformer: (schema: any) => {
    return schema;
  }
};

export default {
  GraphQLAuthEnhancer,
  graphQLAuthDirectives,
};