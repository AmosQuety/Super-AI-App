// src/middleware/error-handling.ts
import { ApolloError, AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import { logger } from '../utils/logger';

/**
 * GraphQL-specific error classes with proper Apollo integration
 */
export class GraphQLAppError extends ApolloError {
  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    extensions?: Record<string, any>
  ) {
    super(message, code, extensions);
  }
}

export class GraphQLValidationError extends UserInputError {
  constructor(message: string, details?: any) {
    super(message, { details, code: 'VALIDATION_ERROR' });
  }
}

export class GraphQLAuthenticationError extends AuthenticationError {
  constructor(message: string = 'Authentication required') {
    super(message, { code: 'AUTHENTICATION_ERROR' });
  }
}

export class GraphQLForbiddenError extends ForbiddenError {
  constructor(message: string = 'Access denied') {
    super(message, { code: 'FORBIDDEN' });
  }
}

export class GraphQLNotFoundError extends ApolloError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND');
  }
}

export class GraphQLRateLimitError extends ApolloError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * GraphQL error formatter for consistent error responses
 */
export const graphQLErrorFormatter = (error: any) => {
  const { message, path, extensions } = error;
  
  // Log the error
  logger.error('GraphQL Error', {
    message,
    path: path?.join('.'),
    code: extensions?.code,
    stack: error.stack,
  });

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && !extensions?.code) {
    return new ApolloError('Internal server error', 'INTERNAL_ERROR');
  }

  return error;
};

/**
 * GraphQL query complexity calculator (enhanced)
 */
export const calculateQueryComplexity = (query: string, variables?: any): number => {
  const complexityWeights = {
    Query: {
      users: 10,
      me: 1,
      chats: 5,
      chatHistory: 8,
      faceServiceStatus: 1,
    },
    Mutation: {
      register: 15,
      login: 10,
      createChat: 8,
      addMessage: 5,
      generateGeminiContent: 20,
      updateProfile: 3,
      changePassword: 5,
    },
    // Field weights for nested queries
    User: {
      chats: 3,
      hasFaceRegistered: 2,
    },
    Chat: {
      messages: 2,
      user: 1,
    }
  };

  let complexity = 0;
  
  // Simple complexity calculation (in real app, use graphql-query-complexity library)
  if (query.includes('users')) complexity += complexityWeights.Query.users;
  if (query.includes('chats')) complexity += complexityWeights.Query.chats;
  if (query.includes('chatHistory')) complexity += complexityWeights.Query.chatHistory;
  
  return complexity;
};

/**
 * GraphQL query depth limiter
 */
export const checkQueryDepth = (query: string, maxDepth: number = 10): boolean => {
  // Simple depth check (in real app, use proper GraphQL AST parsing)
  const depth = (query.match(/{/g) || []).length;
  return depth <= maxDepth;
};

export default {
  GraphQLAppError,
  GraphQLValidationError,
  GraphQLAuthenticationError,
  GraphQLForbiddenError,
  GraphQLNotFoundError,
  GraphQLRateLimitError,
  graphQLErrorFormatter,
  calculateQueryComplexity,
  checkQueryDepth,
};