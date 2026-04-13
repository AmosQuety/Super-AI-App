import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";

export const taskQueries = {
  task: async (_: any, { id }: { id: string }, context: AppContext) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to view tasks");
    }

    return context.taskService.getTaskByIdForUser(id, context.user.userId);
  },

  myTasks: async (
    _: any,
    { limit = 20, includeArchived = false }: { limit?: number; includeArchived?: boolean },
    context: AppContext,
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to view tasks");
    }

    return context.taskService.getRecentTasksByUser(context.user.userId, {
      limit,
      includeArchived,
    });
  },
};