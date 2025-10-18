// src/resolvers/types/chatResolvers.ts - UPDATED
import { AppContext } from "./context";

export const chatResolvers = {
  user: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.user.findUnique({
      where: { id: parent.userId },
    });
  },
  
  messages: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.message.findMany({
      where: { chatId: parent.id },
      orderBy: { createdAt: "asc" },
    });
  },
  
  createdAt: (parent: any) => {
    return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
  },
  
  updatedAt: (parent: any) => {
    return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null;
  },
};