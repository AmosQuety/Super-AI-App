// src/resolvers/queries/chatQueries.ts
import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { redisClient } from "../../lib/redis";

export const chatQueries = {
  chats: async (_: any, { userId }: { userId: string }, context: AppContext) => {
    if (!context.user) throw new AuthenticationError("You must be logged in");

    if (redisClient) {
      const cacheKey = `user:${userId}:chats`;
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const data = await context.chatService.getUserChats(userId);
      await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 60);
      return data;
    }

    return context.chatService.getUserChats(userId);
  },

  chatHistory: async (
    _: any,
    { chatId, limit = 20, offset = 0 }: { chatId: string; limit?: number; offset?: number },
    context: AppContext
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to view chat history");
    }

    if (redisClient) {
      const cacheKey = `user:${context.user.userId}:chatHistory:${chatId}:limit:${limit}:offset:${offset}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const data = await context.chatService.getChatHistory(chatId, limit, offset);
      await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 30);
      return data;
    }

    return context.chatService.getChatHistory(chatId, limit, offset);
  },
};