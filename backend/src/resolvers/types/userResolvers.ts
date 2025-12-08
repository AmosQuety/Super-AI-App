// src/resolvers/types/userResolvers.ts
import { AppContext } from "./context";

export const userResolvers = {
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
  
  createdAt: (parent: any) => {
    return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
  },
  
  updatedAt: (parent: any) => {
    return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null;
  },
};