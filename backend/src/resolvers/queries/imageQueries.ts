// src/resolvers/queries/imageQueries.ts
import { AppContext } from "../types/context";
import { AuthorizationService } from "../../auth/authorization";

export const imageQueries = {
  images: async (_: any, { userId }: { userId: string }, context: AppContext) => {
    AuthorizationService.requireSelfOrAdmin(context, userId);

    return await context.prisma.imageGeneration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },
};
