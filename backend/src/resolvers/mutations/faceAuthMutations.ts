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
  // REGISTER (Enrollment)
  // ==========================================
  addFace: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    if (!context.user) throw new AuthenticationError("Login required.");

    // 1. Health Check
    const health = await faceService.checkHealth();
    if (!health.isOnline) return { success: false, message: "Biometric engine offline." };

    try {
      // 2. Identify User
      const currentUser = await context.prisma.user.findUnique({
        where: { id: context.user.id },
        select: { name: true, email: true }
      });
      
      if (!currentUser?.email) return { success: false, message: "User email not found." };

      // 3. Call Service (Global Registration)
      // We pass the PROMISE 'image' directly now
      const result = await faceService.registerFace(
        context.user.id,        
        "global",               
        currentUser.email,      
        image 
      );

      // 4. Handle Result
      if (result.success) {
        await context.prisma.user.update({
            where: { id: context.user.id },
            data: { hasFaceRegistered: true }
        });

        logger.info("✅ Face registration successful", { userId: context.user.id });
        return {
          success: true,
          message: `Face ID enabled! System now holds ${result.total_faces} identities.`,
        };
      } 
      
      return { success: false, message: result.message };

    } catch (error: any) {
      logger.error("AddFace Error:", error.message);
      return { success: false, message: "Biometric enrollment failed." };
    }
  },

  // ==========================================
  // LOGIN (Verification)
  // ==========================================
  loginWithFace: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    logger.info("🔐 Face login attempt...");

    // 1. Health Check
    const health = await faceService.checkHealth();
    if (!health.isOnline) return { success: false, message: "Service offline. Use password." };

    try {
      // 2. Call Service (Global Verification)
      // We send "global" because we don't know who the user is yet
      const verification = await faceService.verifyFace(
        "global", 
        "global", 
        image
      );

      // 3. Handle Result
      if (verification.success && verification.matchedUser) {
        logger.info(`✅ Match Found: ${verification.matchedUser}`);

        // Find user by EMAIL (because we saved email as the name in addFace)
        const foundUser = await context.prisma.user.findUnique({
          where: { email: verification.matchedUser },       
        });

        if (!foundUser) return { success: false, message: "Face recognized, but account not found." };
        if (!foundUser.isActive) return { success: false, message: "Account disabled." };

        // Generate Token
        const token = SecurityConfig.generateToken(foundUser);

        // Update Stats
        await context.prisma.user.update({
            where: { id: foundUser.id },
            data: { lastLoginAt: new Date() }
        });

        return {
          success: true,
          token: token,
          user: foundUser,
          message: `Welcome back, ${foundUser.name}! (Mood: ${verification.emotion})`,
        };
      } 
      
      // 4. Failure
      logger.warn(`⛔ Login Failed: ${verification.error || verification.emotion}`);
      return {
        success: false,
        token: null,
        user: null,
        message: verification.emotion ? `Liveness Failed: ${verification.emotion}` : "Face not recognized.",
      };

    } catch (error: any) {
      logger.error("Login Error:", error.message);
      return { success: false, message: "Biometric processing error." };
    }
  },

  // ==========================================
  // REMOVE
  // ==========================================
  removeFace: async (_: any, __: any, context: AppContext) => {
    if (!context.user) throw new AuthenticationError("Unauthorized");
    
    await context.prisma.user.update({
        where: { id: context.user.id },
        data: { hasFaceRegistered: false }
    });

    return { success: true, message: "Face ID disabled." };
  },
};