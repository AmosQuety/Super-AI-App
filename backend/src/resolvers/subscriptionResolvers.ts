// src/resolvers/subscriptionResolvers.ts
import { PubSub } from 'graphql-subscriptions';
import { withFilter } from 'graphql-subscriptions';

// Create PubSub instance
export const pubsub = new PubSub();

export const subscriptionResolvers = {
  Subscription: {
    messageAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator('MESSAGE_ADDED'), // FIXED: asyncIterableIterator instead of asyncIterator
        (payload: any, variables: any) => { // FIXED: Added type annotations
          // Only send messages for the specific chat
          return payload.messageAdded.chatId === variables.chatId;
        }
      ),
    },
  },
};