// src/resolvers/mutations/faceAuthMutations.ts
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { SecurityConfig } from "../../auth/security"; 
import { logger } from "../../utils/logger";
import { FaceRecognitionService } from "../../services/faceRecognitionService";
import { createClient } from "@supabase/supabase-js";

const faceService = new FaceRecognitionService();

// Initialize Supabase for cleanup
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.Supabase_Service_Role_Secret || process.env.SUPABASE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export const faceAuthMutations = {
  
  // ==========================================
  // 1. REGISTER USER FACE (Login Security)
  // ==========================================
  registerUserFace: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    if (!context.user) throw new AuthenticationError("Login required.");

    try {
      // Get User Email
      const currentUser = await context.prisma.user.findUnique({
        where: { id: context.user.userId },
        select: { email: true }
      });
      
      if (!currentUser?.email) return { success: false, message: "User email not found." };

      logger.info(`🔐 Enrolling User Face for Login: ${currentUser.email}`);

      // HARDCODED "global" - Cannot fail
      const result = await faceService.registerFace(
        context.user.userId,        
        "global",               
        currentUser.email,      
        image 
      );

      if (result.success) {
        await context.prisma.user.update({
            where: { id: context.user.userId },
            data: { hasFaceRegistered: true }
        });
        return { success: true, message: "Face Login enabled successfully." };
      } 
      
      return { success: false, message: result.message };

    } catch (error: any) {
      logger.error("RegisterUserFace Error:", error.message);
      return { success: false, message: "Enrollment failed." };
    }
  },

  // ==========================================
  // 2. ADD WORKSPACE CHARACTER (Playground)
  // ==========================================
   addWorkspaceCharacter: async (
    _: any,
    { image, workspaceId, name }: { image: Promise<Upload>, workspaceId: string, name: string },
    context: AppContext
  ) => {
    if (!context.user) throw new AuthenticationError("Login required.");
    
    if (!workspaceId || !name) {
        throw new UserInputError("Workspace ID and Name are required.");
    }

    try {
      logger.info(`🎭 Adding Character '${name}' to Workspace '${workspaceId}'`);

      const result = await faceService.registerFace(
        context.user.userId,        
        workspaceId,        
        name,             
        image 
      );

      if (result.success) {
        // FIX: Ensure we use the path from Python (result.image_path)
        // If Python didn't return it (older version), we fallback to manual string.
        const finalPath = result.image_path || `${context.user.userId}/${workspaceId}/${name}.jpg`;
        
        logger.debug("📝 Saving Face Path from Python:", finalPath); 

        await context.prisma.face.create({
            data: {
                name: name,
                imageUrl: finalPath, 
                workspaceId: workspaceId
            }
        });

        return { success: true, message: `Added ${name} to workspace.` };
      } 
      
      return { success: false, message: result.message };

    } catch (error: any) {
      logger.error("AddCharacter Error:", error.message);
      return { success: false, message: "Failed to add character." };
    }
  },


  

  // ==========================================
  // LOGIN (Global Verification) 
  // ==========================================
  loginWithFace: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    logger.info("🔐 Face login attempt...");
    const health = await faceService.checkHealth();
    if (!health.isOnline) return { success: false, message: "Service offline. Use password." };

    try {
      // Always verify against "global" for login
      const verification = await faceService.verifyFace("global", "global", image);

      if (verification.success && verification.matchedUser) {
        const foundUser = await context.prisma.user.findUnique({
          where: { email: verification.matchedUser },       
        });

        if (!foundUser) return { success: false, message: "Account not found." };
        if (!foundUser.isActive) return { success: false, message: "Account disabled." };

        const token = SecurityConfig.generateToken(foundUser);
        await context.prisma.user.update({ where: { id: foundUser.id }, data: { lastLoginAt: new Date() } });

        return {
          success: true,
          token: token,
          user: foundUser,
          message: `Welcome back, ${foundUser.name}! (${verification.emotion})`,
        };
      } 
      
      return {
        success: false,
        token: null,
        user: null,
        message: verification.emotion ? `Liveness: ${verification.emotion}` : "Face not recognized.",
      };

    } catch (error: any) {
      logger.error("Login Error:", error.message);
      return { success: false, message: "Login failed." };
    }
  },

  // ==========================================
  // WORKSPACE VERIFICATION (Playground Testing) - NEW!
  // ==========================================
  verifyFaceInWorkspace: async (
    _: any,
    { image, workspaceId }: { image: Promise<Upload>, workspaceId: string },
    context: AppContext
  ) => {
    if (!context.user) throw new AuthenticationError("Login required");

    try {
      logger.info(`🧪 Testing recognition in workspace: ${workspaceId}`);

      // Call service with specific Workspace ID
      const verification = await faceService.verifyFace(
        context.user.userId, 
        workspaceId, // <--- Pass the specific workspace
        image
      );

      if (verification.success) {
        return {
            success: true,
            message: `Match Found: ${verification.matchedUser} (${verification.confidence}%)`,
            user: { name: verification.matchedUser } as any, // Mock user object for UI
            token: null // No token needed for playground test
        };
      } else {
        return {
            success: false,
            message: `No Match Found in this workspace.`,
            user: null,
            token: null
        };
      }

    } catch (error: any) {
      logger.error("Workspace Verify Error:", error.message);
      return { success: false, message: "Verification failed." };
    }
  },

  // ==========================================
  // OTHER MUTATIONS
  // ==========================================
  removeFace: async (_: any, __: any, context: AppContext) => {
    if (!context.user) throw new AuthenticationError("Unauthorized");
    const userId = context.user.userId;

    try {
      // 1. Get User Email
      const currentUser = await context.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (currentUser?.email) {
        logger.info(`🗑️ Disabling Face ID for user: ${currentUser.email}`);

        // 2. Delete Embedding from DB
        await supabase
          .from("face_embeddings")
          .delete()
          .eq("user_id", userId)
          .eq("workspace_id", "global");

        // 3. Delete Image from Storage
        // We try JPG and PNG since the suffix might vary
        await supabase.storage
          .from("biometric_faces")
          .remove([
            `${userId}/global/${currentUser.email}.jpg`,
            `${userId}/global/${currentUser.email}.png`,
            `${userId}/global/${currentUser.email}.webm`
          ]);
      }

      // 4. Update User Flag
      await context.prisma.user.update({
        where: { id: userId },
        data: { hasFaceRegistered: false }
      });

      return { success: true, message: "Face ID disabled." };
    } catch (err: any) {
      logger.error("❌ removeFace Error:", err);
      return { success: false, message: err.message || "Failed to remove Face ID" };
    }
  },

  analyzeFaceAttribute: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    if (!context.user) {
      throw new AuthenticationError("Login required to analyze faces");
    }

    const userId = context.user.userId;
    let task: any = null;

    try {
      task = await context.taskService.createTask({
        userId,
        feature: "face_processing",
        metadata: { operation: "mirror" },
      });
    } catch (taskError) {
      // Task tracking failure must not block core functionality.
      // Log for observability but allow face analysis to proceed.
      console.error(
        "[faceAuthMutations] createTask failed — proceeding without task record:",
        taskError
      );
    }
    
    if (task) {
      await context.taskService.markProcessing(task.id, userId, { operation: "mirror" });
    }

    try {
      if (task && userId) await context.taskService.updateProgress(task.id, userId, 30, { phase: "analyzing" });
      const result = await faceService.analyzeFace(image);
      
      if (task && userId) {
        if (result.success) {
          await context.taskService.completeTask(task.id, userId, {
             metadata: { operation: "mirror", ...result.data }
          });
        } else {
          await context.taskService.failTask(task.id, userId, result.error || "Analysis failed", {
            metadata: { operation: "mirror" }
          });
        }
      }
      return result;
    } catch (error: any) {
      if (task && userId) {
        await context.taskService.failTask(task.id, userId, error.message || "Analysis crashed", {
          metadata: { operation: "mirror" }
        });
      }
      throw error;
    }
  },

  compareFaces: async (_: any, { image1, image2 }: any, context: AppContext) => {
    const userId = context.user?.userId;
    let task: any = null;

    if (userId) {
      task = await context.taskService.createTask({
        userId,
        feature: "face_processing",
        metadata: { operation: "twin" },
      });
      await context.taskService.markProcessing(task.id, userId, { operation: "twin" });
    }

    try {
      const health = await faceService.checkHealth();
      if (!health.isOnline) {
        if (task && userId) await context.taskService.failTask(task.id, userId, "Biometric engine offline");
        return { success: false, error: "Biometric engine is offline." };
      }

      if (task && userId) await context.taskService.updateProgress(task.id, userId, 40, { phase: "comparing" });
      const result = await faceService.compareFaces(image1, image2);
      
      if (task && userId) {
        if (result.success) {
          await context.taskService.completeTask(task.id, userId, {
            metadata: { operation: "twin", ...result.data }
          });
        } else {
          await context.taskService.failTask(task.id, userId, result.error || "Comparison failed");
        }
      }
      return { success: result.success, data: result.data, error: result.error };
    } catch (error: any) {
      if (task && userId) await context.taskService.failTask(task.id, userId, error.message);
      return { success: false, error: "Comparison failed: " + error.message, data: null };
    }
  },

  findFaceInCrowd: async (_: any, { target, crowd }: any, context: AppContext) => {
    const userId = context.user?.userId;
    let task: any = null;

    if (userId) {
      task = await context.taskService.createTask({
        userId,
        feature: "face_processing",
        metadata: { operation: "find" },
      });
      await context.taskService.markProcessing(task.id, userId, { operation: "find" });
    }

    try {
      if (task && userId) await context.taskService.updateProgress(task.id, userId, 20, { phase: "scanning-crowd" });
      const result = await faceService.findFaceInCrowd(target, crowd);
      
      if (task && userId) {
        if (result.success) {
          await context.taskService.completeTask(task.id, userId, {
            metadata: { 
              operation: "find", 
              matches: result.matches, 
              processed_image: result.processed_image 
            }
          });
        } else {
          await context.taskService.failTask(task.id, userId, result.error || "Crowd scan failed");
        }
      }
      return { success: result.success, matches: result.matches, processed_image: result.processed_image, error: result.error };
    } catch (error: any) {
      if (task && userId) await context.taskService.failTask(task.id, userId, error.message);
      return { success: false, matches: 0, processed_image: null, error: error.message };
    }
  },
};