// src/resolvers/types/userResolvers.ts
import { AppContext } from "./context";

export const userResolvers = {
  tasks: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.task.findMany({
      where: { userId: parent.id },
      orderBy: { updatedAt: "desc" },
    });
  },

  chats: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.chat.findMany({
      where: { userId: parent.id },
      orderBy: { createdAt: "desc" },
    });
  },
  
  images: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.imageGeneration.findMany({
      where: { userId: parent.id },
      orderBy: { createdAt: "desc" },
    });
  },
  
  audioJobs: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.audioJob.findMany({
      where: { userId: parent.id },
      orderBy: { createdAt: "desc" },
    });
  },
  
  documents: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.document.findMany({
      where: { userId: parent.id },
      orderBy: { createdAt: "desc" },
    });
  },
  
  // FIX IS HERE: We check the parent object (Prisma User) directly
  hasFaceRegistered: async (parent: any, _: any, context: AppContext) => {
    // 1. If the parent object already has the boolean, return it
    if (typeof parent.hasFaceRegistered === 'boolean') {
      return parent.hasFaceRegistered;
    }

    // 2. If not (e.g. it wasn't selected in the query), fetch it from DB
    const user = await context.prisma.user.findUnique({
      where: { id: parent.id },
      select: { hasFaceRegistered: true }
    });
    
    return !!user?.hasFaceRegistered;
  },
  
  preferences: (parent: any) => {
    if (!parent.preferences) return null;
    try {
      return JSON.parse(parent.preferences);
    } catch (e) {
      console.error("Error parsing user preferences:", e);
      return null;
    }
  },
  
  createdAt: (parent: any) => {
    return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
  },
  
  updatedAt: (parent: any) => {
    return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null;
  },

  totalChats: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.chat.count({ where: { userId: parent.id } });
  },

  totalMessages: async (parent: any, _: any, context: AppContext) => {
    // Count only user-sent messages across all their chats
    const chats = await context.prisma.chat.findMany({
      where: { userId: parent.id },
      select: { id: true },
    });
    const chatIds = chats.map((c: { id: string }) => c.id);
    if (chatIds.length === 0) return 0;
    return await context.prisma.message.count({
      where: { chatId: { in: chatIds }, role: 'user' },
    });
  },

  totalVoiceJobs: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.audioJob.count({ where: { userId: parent.id } });
  },

  totalDocuments: async (parent: any, _: any, context: AppContext) => {
    return await context.prisma.document.count({ where: { userId: parent.id } });
  },
};