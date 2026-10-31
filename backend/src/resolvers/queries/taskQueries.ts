import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { withoutGeneratedImages } from "../../services/taskMetadata";

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

    const tasks = await context.taskService.getRecentTasksByUser(context.user.userId, {
      limit,
      includeArchived,
    });
    // The single-task query still returns the full metadata, for restoring one result.
    return tasks.map((task) => ({ ...task, metadata: withoutGeneratedImages(task.metadata) }));
  },
};