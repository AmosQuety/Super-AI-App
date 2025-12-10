// src/resolvers/index.ts - UPDATED
import { scalarResolvers } from "./scalars";
import { queryResolvers } from "./queries";
import { mutationResolvers } from "./mutations";
import { userResolvers, chatResolvers, messageResolvers } from "./types";
import { authResolvers } from "./auth/resolvers";
import { IResolvers } from "@graphql-tools/utils";
import { subscriptionResolvers } from "./subscriptionResolvers";
import { sendMessageWithResponse } from "./sendMessageWithResponse";
import { AppContext } from "./types/context";
import { imageGenerationResolvers } from "./imageGenerationResolvers";
import { workspaceResolvers } from "./workspaceResolvers";

export const resolvers: IResolvers = {
  ...scalarResolvers,
  ...authResolvers,
  
  Query: { 
    ...authResolvers.Query,
    ...queryResolvers,
    ...imageGenerationResolvers.Query,
    ...workspaceResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...mutationResolvers,
    ...sendMessageWithResponse,
    ...imageGenerationResolvers.Mutation,
     ...workspaceResolvers.Mutation
  },
  
  User: { 
    ...authResolvers.User,
    ...userResolvers,
  },
  
  Chat: { 
    ...chatResolvers,
  },
  
  Message: { 
    ...messageResolvers 
  },

  Workspace: workspaceResolvers.Workspace ,

  ImageGeneration: {
    user: async (parent: any, _: any, context: AppContext) => {
      return await context.prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
    createdAt: (parent: any) => parent.createdAt?.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt?.toISOString(),
  },

  AudioJob: {
    user: async (parent: any, _: any, context: AppContext) => {
      return await context.prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
    createdAt: (parent: any) => parent.createdAt?.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt?.toISOString(),
  },

  Document: {
    user: async (parent: any, _: any, context: AppContext) => {
      return await context.prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
    createdAt: (parent: any) => parent.createdAt?.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt?.toISOString(),
  },

  ...subscriptionResolvers,
};