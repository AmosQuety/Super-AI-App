// src/resolvers/queries/chatQueries.ts
import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";

export const chatQueries = {
  chats: async (_: any, { userId }: { userId: string }, context: AppContext) => {
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
    return context.chatService.getChatHistory(chatId, limit, offset);
  },
};