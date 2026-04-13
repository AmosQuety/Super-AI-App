import { AppContext } from "./types/context";
import { AuthenticationError } from "apollo-server-express";
import { redisClient } from "../lib/redis";
import { logger } from "../utils/logger";

export const workspaceResolvers = {
  Query: {
    myWorkspaces: async (_: any, __: any, context: AppContext) => {
      if (!context.user) throw new AuthenticationError("Login required");

      const userId = context.user.userId;

      if (redisClient) {
        const cacheKey = `user:${userId}:workspaces`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const data = await context.prisma.workspace.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' }, // Default first
          include: { _count: { select: { faces: true } } }
        });
        await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 60);
        return data;
      }

      return await context.prisma.workspace.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }, // Default first
        include: { _count: { select: { faces: true } } }
      });
    }
  },

  Mutation: {
    createWorkspace: async (_: any, { name, description }: any, context: AppContext) => {
      if (!context.user) throw new AuthenticationError("Login required");

      const workspace = await context.prisma.workspace.create({
        data: {
          name,
          description,
          userId: context.user.userId,
          isDefault: false
        }
      });
      if (redisClient) await redisClient.del(`user:${context.user.userId}:workspaces`);
      return workspace;
    },

    deleteWorkspace: async (_: any, { id }: any, context: AppContext) => {
      if (!context.user) throw new AuthenticationError("Login required");

      const workspace = await context.prisma.workspace.findUnique({ where: { id } });
      
      // Security: Only owner can delete, and cannot delete default
      if (!workspace || workspace.userId !== context.user.userId) throw new Error("Not found");
      if (workspace.isDefault) throw new Error("Cannot delete default workspace");

      // 1. Delete faces in DB
      await context.prisma.face.deleteMany({ where: { workspaceId: id } });
      // 2. Delete workspace
      await context.prisma.workspace.delete({ where: { id } });
      
      if (redisClient) await redisClient.del(`user:${context.user.userId}:workspaces`);

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
  },



  Face: {
    imageUrl: (parent: any) => {
      const SUPABASE_URL = process.env.SUPABASE_URL; 
      const dbPath = parent.imageUrl || parent.filePath;
      
      // 1. Check if Env Var exists
      if (!SUPABASE_URL) {
          logger.error("❌ ERROR: SUPABASE_URL is missing in Node .env file!");
          return null; 
      }

      
      if (!dbPath) {
          logger.error("❌ ERROR: No image path found in database for face:", parent.name);
          return null;
      }

       // If Python returned a full URL (rare), use it
      if (dbPath && dbPath.startsWith("http")) return dbPath;
      

      // 3. Construct URL
      if (dbPath.startsWith("http")) return dbPath;
      
      const fullUrl = `${SUPABASE_URL}/storage/v1/object/public/biometric_faces/${dbPath}`;
      
      // 4. Construction complete
      logger.debug("🔗 Generated URL:", fullUrl);
      
      return fullUrl;
    }
  }
};
