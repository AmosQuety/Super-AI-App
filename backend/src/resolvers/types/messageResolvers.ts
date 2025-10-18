// src/resolvers/types/messageResolvers.ts - UPDATED
import { AppContext } from "./context";

export const messageResolvers = {
  chat: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.chat.findUnique({
      where: { id: parent.chatId },
    });
  },
  
  createdAt: (parent: any) => {
    return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
  },
  
  updatedAt: (parent: any) => {
    return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null;
  },
};