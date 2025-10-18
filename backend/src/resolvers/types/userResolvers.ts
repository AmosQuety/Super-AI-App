// src/resolvers/types/userResolvers.ts - UPDATED
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
  
  hasFaceRegistered: async (parent: any, _: any, context: AppContext) => {
    return await context.faceRecognitionService.checkUserHasFace(parent.id);
  },
  
  createdAt: (parent: any) => {
    return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
  },
  
  updatedAt: (parent: any) => {
    return parent.updatedAt ? new Date(parent.updatedAt).toISOString() : null;
  },
};