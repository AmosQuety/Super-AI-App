// src/resolvers/subscriptionResolvers.ts
import { PubSub } from 'graphql-subscriptions';
import { withFilter } from 'graphql-subscriptions';
import { requireChatAccess } from '../auth/chatAccess';

// Create PubSub instance
export const pubsub = new PubSub();

// Ownership is checked once, when the subscription starts; events are then
// filtered down to the subscribed chat.
function chatSubscription(topic: string, payloadField: string) {
  const eventsForChat = withFilter(
    () => pubsub.asyncIterableIterator(topic),
    (payload: any, variables: any) => payload[payloadField].chatId === variables.chatId
  );

  return {
    subscribe: async (root: any, args: { chatId: string }, context: any, info: any) => {
      await requireChatAccess(context, args.chatId);
      return eventsForChat(root, args, context, info);
    },
  };
}

export const subscriptionResolvers = {
  Subscription: {
    messageAdded: chatSubscription('MESSAGE_ADDED', 'messageAdded'),
    messageChunkAdded: chatSubscription('MESSAGE_CHUNK_ADDED', 'messageChunkAdded'),
  },
};
