// src/resolvers/mutations/faceAuthMutations.ts
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { SecurityConfig } from "../../auth/security"; 
import { logger } from "../../utils/logger";
import { FaceRecognitionService } from "../../services/faceRecognitionService";

const faceService = new FaceRecognitionService();

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
        
        console.log("📝 Saving Face Path from Python:", finalPath); 

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
    await context.prisma.user.update({ where: { id: context.user.userId }, data: { hasFaceRegistered: false } });
    return { success: true, message: "Face ID disabled." };
  },

  analyzeFaceAttribute: async (_: any, { image }: { image: Promise<Upload> }, _context: AppContext) => {
    return await faceService.analyzeFace(image);
  },

  compareFaces: async (_: any, { image1, image2 }: any, _context: AppContext) => {
    try {
      const health = await faceService.checkHealth();
      if (!health.isOnline) return { success: false, error: "Biometric engine is offline." };
      const result = await faceService.compareFaces(image1, image2);
      return { success: result.success, data: result.data, error: null };
    } catch (error: any) {
      return { success: false, error: "Comparison failed: " + error.message, data: null };
    }
  },

  findFaceInCrowd: async (_: any, { target, crowd }: any, _context: AppContext) => {
    try {
      const result = await faceService.findFaceInCrowd(target, crowd);
      return { success: result.success, matches: result.matches, processed_image: result.processed_image, error: null };
    } catch (error: any) {
      return { success: false, matches: 0, processed_image: null, error: error.message };
    }
  },
};