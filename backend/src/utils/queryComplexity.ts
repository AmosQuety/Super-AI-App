// src/utils/queryComplexity.ts
import { GraphQLSchema, separateOperations } from 'graphql';

export class QueryComplexityCalculator {
  static calculateComplexity(query: string, schema: GraphQLSchema): number {
    // Simple complexity calculation based on:
    // - Number of fields requested
    // - Depth of nested fields
    // - Presence of lists/arrays
    
    let complexity = 0;
    const fieldWeights = {
      chats: 5,
      messages: 3,
      users: 10, // High cost for fetching all users
      faceServiceStatus: 1,
    };

    // Basic field counting (you'd want a more sophisticated implementation)
    Object.keys(fieldWeights).forEach(field => {
      if (query.includes(field)) {
        complexity += fieldWeights[field as keyof typeof fieldWeights];
      }
    });

    return complexity;
  }

  static validateComplexity(query: string, schema: GraphQLSchema, maxComplexity: number = 100) {
    const complexity = this.calculateComplexity(query, schema);
    
    if (complexity > maxComplexity) {
      throw new Error(`Query too complex. Complexity: ${complexity}, Max: ${maxComplexity}`);
    }
    
    return complexity;
  }
}