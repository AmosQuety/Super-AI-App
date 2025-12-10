// src/resolvers/mutations/faceAuthMutations.ts
import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { SecurityConfig } from "../../auth/security"; 
import { logger } from "../../utils/logger";
import { FaceRecognitionService } from "../../services/faceRecognitionService";

const faceService = new FaceRecognitionService();

export const faceAuthMutations = {
  
  // ==========================================
  // REGISTER (Enrollment) - Updated for Workspaces
  // ==========================================
  addFace: async (
    _: any,
    // Update arguments to accept workspace details
    { image, workspaceId, characterName }: { image: Promise<Upload>, workspaceId?: string, characterName?: string },
    context: AppContext
  ) => {
    if (!context.user) throw new AuthenticationError("Login required.");

    const health = await faceService.checkHealth();
    if (!health.isOnline) return { success: false, message: "Biometric engine offline." };

    try {
      // 1. Determine Target Workspace
      // If no workspaceId provided, default to "global" (for Main App Login)
      const targetWorkspace = workspaceId || "global";
      
      // 2. Determine Name
      // If global, use User Email. If workspace, use provided Character Name (e.g. "Jon Snow")
      let targetName = "";
      
      if (targetWorkspace === "global") {
         const currentUser = await context.prisma.user.findUnique({
            where: { id: context.user.id },
            select: { email: true }
         });
         targetName = currentUser?.email || "";
      } else {
         targetName = characterName || "Unknown Character";
      }

      if (!targetName) return { success: false, message: "Could not determine identity name." };

      logger.info(`📸 Registering '${targetName}' to workspace '${targetWorkspace}'`);

      // 3. Call Service
      const result = await faceService.registerFace(
        context.user.id,        
        targetWorkspace,        // <--- Dynamic ID passed here
        targetName,             // <--- Dynamic Name passed here
        image 
      );

      // 4. Update Database
      if (result.success) {
        
        if (targetWorkspace === "global") {
            // Main Login Enrollment
            await context.prisma.user.update({
                where: { id: context.user.id },
                data: { hasFaceRegistered: true }
            });
        } else {
            // Playground Character Enrollment
            // Record this face in the Face table linked to the Workspace
            await context.prisma.face.create({
                data: {
                    name: targetName,
                    imageUrl: `${context.user.id}/${targetWorkspace}/${targetName}.jpg`,
                    workspaceId: targetWorkspace
                }
            });
        }

        return {
          success: true,
          message: `Successfully added ${targetName} to ${targetWorkspace === 'global' ? 'Face Login' : 'Workspace'}.`,
        };
      } 
      
      return { success: false, message: result.message };

    } catch (error: any) {
      logger.error("AddFace Error:", error.message);
      return { success: false, message: "Biometric enrollment failed." };
    }
  },

  // ==========================================
  // LOGIN (Global Verification) - Keep as is
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
        context.user.id, 
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
    await context.prisma.user.update({ where: { id: context.user.id }, data: { hasFaceRegistered: false } });
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