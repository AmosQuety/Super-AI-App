// src/resolvers/mutations/faceAuthMutations.ts
import { AuthenticationError } from "apollo-server-express";
import axios from "axios";
import FormData from "form-data";
import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { SecurityConfig } from "../../auth/security"; 
import { logger } from "../../utils/logger";

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

const checkFaceServiceHealth = async () => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/`, {
      timeout: 3000,
    });
    return {
      isOnline: response.status === 200,
      data: response.data,
    };
  } catch (error) {
    logger.error("Error checking face service health:", error);
    return {
      isOnline: false,
      data: null,
    };
  }
};

export const faceAuthMutations = {
  addFace: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to add a face.");
    }

    const healthCheck = await checkFaceServiceHealth();
    if (!healthCheck.isOnline) {
      return {
        success: false,
        message: "Biometric engine is offline. Please contact admin.",
      };
    }

    try {
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      // FIX: Fetch the fresh user from DB to get the name (since token doesn't have it)
      const currentUser = await context.prisma.user.findUnique({
        where: { id: context.user.id },
        select: { name: true, email: true }
      });
      
      const identifier = currentUser?.name || currentUser?.email || "User_" + context.user.id;

      const formData = new FormData();
      formData.append("name", identifier);
      formData.append("file", stream, { filename, contentType: mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/register`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      if (response.data.status === "success") {
        await context.prisma.user.update({
            where: { id: context.user.id },
            data: { hasFaceRegistered: true }
        });

        return {
          success: true,
          message: `Face ID enabled! System now holds ${response.data.total_faces} identities.`,
        };
      } else {
        return {
          success: false,
          message: response.data.message || "Failed to register face.",
        };
      }
    } catch (error: any) {
      logger.error("Error calling face-recognition service:", error.message);
      return {
        success: false,
        message: "An error occurred while processing your biometric data.",
      };
    }
  },

  loginWithFace: async (
    _: any,
    { image }: { image: Promise<Upload> },
    context: AppContext
  ) => {
    const healthCheck = await checkFaceServiceHealth();
    if (!healthCheck.isOnline) {
      return {
        success: false,
        token: null,
        user: null,
        message: "Face service offline. Use password.",
      };
    }

    try {
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append("file", stream, { filename, contentType: mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/verify`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 10000,
          validateStatus: (status) => status < 500, 
        }
      );

      const { access, user, emotion_detected, error } = response.data;

      if (access === "GRANTED" && user) {
        
        const foundUser = await context.prisma.user.findFirst({
          where: {
            OR: [
                { name: user },
                { email: user },
                { name: user.replace(/_/g, " ") } 
            ]
          },
        });

        if (!foundUser) {
            logger.warn(`Face match '${user}' found in Python but not in Postgres.`);
            return {
                success: false,
                token: null,
                user: null,
                message: "Biometric match found, but account linking failed.",
            };
        }

        if (!foundUser.isActive) {
            return {
                success: false,
                token: null,
                user: null,
                message: "Account is disabled.",
            };
        }

        const token = SecurityConfig.generateToken(foundUser);

        await context.prisma.user.update({
            where: { id: foundUser.id },
            data: { lastLoginAt: new Date() }
        });

        return {
          success: true,
          token: token,
          user: foundUser,
          message: `Welcome, ${foundUser.name}! (Mood: ${emotion_detected})`,
        };

      } else {
        return {
          success: false,
          token: null,
          user: null,
          message: error || "Face not recognized. Please try again.",
        };
      }
    } catch (error: any) {
      logger.error("Error during facial login:", error.message);
      return {
        success: false,
        token: null,
        user: null,
        message: "Biometric processing error.",
      };
    }
  },

  removeFace: async (_: any, __: any, context: AppContext) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to remove your face.");
    }
    
    await context.prisma.user.update({
        where: { id: context.user.id },
        data: { hasFaceRegistered: false }
    });

    return {
      success: true,
      message: "Face ID disabled for this account.",
    };
  },
};