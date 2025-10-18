// src/resolvers/queries/imageQueries.ts
import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";

export const imageQueries = {
  images: async (_: any, { userId }: { userId: string }, context: AppContext) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to view images");
    }

    return await context.prisma.imageGeneration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },
};