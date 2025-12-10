import { AppContext } from "./types/context";
import { AuthenticationError } from "apollo-server-express";

export const workspaceResolvers = {
  Query: {
    myWorkspaces: async (_: any, __: any, context: AppContext) => {
      if (!context.user) throw new AuthenticationError("Login required");
      
      return await context.prisma.workspace.findMany({
        where: { userId: context.user.id },
        orderBy: { createdAt: 'asc' }, // Default first
        include: { _count: { select: { faces: true } } }
      });
    }
  },

  Mutation: {
    createWorkspace: async (_: any, { name, description }: any, context: AppContext) => {
      if (!context.user) throw new AuthenticationError("Login required");

      return await context.prisma.workspace.create({
        data: {
          name,
          description,
          userId: context.user.id,
          isDefault: false
        }
      });
    },

    deleteWorkspace: async (_: any, { id }: any, context: AppContext) => {
      if (!context.user) throw new AuthenticationError("Login required");

      const workspace = await context.prisma.workspace.findUnique({ where: { id } });
      
      // Security: Only owner can delete, and cannot delete default
      if (!workspace || workspace.userId !== context.user.id) throw new Error("Not found");
      if (workspace.isDefault) throw new Error("Cannot delete default workspace");

      // 1. Delete faces in DB
      await context.prisma.face.deleteMany({ where: { workspaceId: id } });
      // 2. Delete workspace
      await context.prisma.workspace.delete({ where: { id } });
      
      // Note: We leave the Python folder. It's safer not to recursively delete files from Node.
      return true;
    }
  },

  Workspace: {
    faceCount: (parent: any) => parent._count?.faces || 0,

    // Allow fetching the actual face list
    faces: async (parent: any, _: any, context: AppContext) => {
      return await context.prisma.face.findMany({
        where: { workspaceId: parent.id },
        orderBy: { createdAt: 'desc' }
      });
    }
  }
};