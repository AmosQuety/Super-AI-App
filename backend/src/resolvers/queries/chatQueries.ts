// src/resolvers/queries/chatQueries.ts
import { AppContext } from "../types/context";
import { chatHistoryCacheKey, chatListCacheKey } from "../../services/chatCache";
import { redisClient } from "../../lib/redis";
import { AuthorizationService } from "../../auth/authorization";
import { requireChatAccess } from "../../auth/chatAccess";

export const chatQueries = {
  chats: async (_: any, { userId }: { userId: string }, context: AppContext) => {
    AuthorizationService.requireSelfOrAdmin(context, userId);

    if (redisClient) {
      const cacheKey = chatListCacheKey(userId);
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
    await requireChatAccess(context, chatId);
    const user = context.user!;

    if (redisClient) {
      const cacheKey = chatHistoryCacheKey(user.userId, chatId, limit, offset);
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const data = await context.chatService.getChatHistory(chatId, limit, offset);
      await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 30);
      return data;
    }

    return context.chatService.getChatHistory(chatId, limit, offset);
  },
};