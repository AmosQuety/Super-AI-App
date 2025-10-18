// src/middleware/authentication.ts

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { createContext } from '../resolvers/types/context';


const prisma = new PrismaClient();

/**
 * GraphQL Context Enhancer - Adds additional auth features to your existing context
 */
export class GraphQLAuthEnhancer {
  /**
   * Enhanced context creation with additional security features
   */
  static async createEnhancedContext({ req, connection }: any) {
    const baseContext = await createContext({ req, connection }); // Your existing function
    
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
            where: { id: baseContext.user.id },
            select: { id: true, email: true, name: true, role: true, isActive: true }
          });
        },
        
        // Audit log for sensitive operations
        logSecurityEvent: (event: string, details: any) => {
          logger.info('Security Event', {
            event,
            userId: baseContext.user?.id,
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
        
        // Reset counters periodically (in a real app, use Redis)
        setTimeout(() => {
          userOperationCounts.delete(key);
        }, 60000); // 1 minute
        
        return true;
      }
    };
  }
}

/**
 * GraphQL Directive-based authentication
 * (For future use with schema directives)
 */
export const graphQLAuthDirectives = {
  // This would be used in your schema with @auth, @hasRole, etc.
  authDirectiveTransformer: (schema: any) => {
    // Implementation for schema directives
    return schema;
  }
};

export default {
  GraphQLAuthEnhancer,
  graphQLAuthDirectives,
};