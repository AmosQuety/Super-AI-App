import { AppContext } from "../types/context";

export const taskResolvers = {
  Task: {
    user: async (parent: any, _: any, context: AppContext) => {
      return context.prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
    createdAt: (parent: any) => parent.createdAt?.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt?.toISOString(),
    startedAt: (parent: any) => parent.startedAt?.toISOString() ?? null,
    completedAt: (parent: any) => parent.completedAt?.toISOString() ?? null,
    failedAt: (parent: any) => parent.failedAt?.toISOString() ?? null,
    canceledAt: (parent: any) => parent.canceledAt?.toISOString() ?? null,
    archivedAt: (parent: any) => parent.archivedAt?.toISOString() ?? null,
  },
};