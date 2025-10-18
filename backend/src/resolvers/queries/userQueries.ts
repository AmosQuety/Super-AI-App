// src/resolvers/queries/userQueries.ts
import { AppContext } from "../types/context";

export const userQueries = {
  users: async (_: any, __: any, context: AppContext) => {
    return context.prisma.user.findMany();
  },
};