// src/resolvers/mutations/faceAuthMutations.ts
import { AuthenticationError } from "apollo-server-express";
import axios from "axios";
import FormData from "form-data";
import { AppContext } from "../types/context";
import { Upload } from "../types/upload";

// Configuration for the Python face recognition service
const PYTHON_SERVICE_URL = "http://127.0.0.1:5001";

// Helper function to check if face service is online
const checkFaceServiceHealth = async () => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return {
      isOnline: true,
      data: response.data,
    };
  } catch (error) {
    console.error("Error checking face service health:", error);
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
        message:
          "Face recognition service is currently offline. Please try again later.",
      };
    }

    try {
      const { createReadStream, filename } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append("image", stream, { filename });
      formData.append("user_id", context.user.id);

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/register-face`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 30000,
        }
      );

      if (response.data.status === "success") {
        return {
          success: true,
          message:
            "Face registered successfully! You can now use facial login.",
        };
      } else {
        return {
          success: false,
          message:
            response.data.message ||
            "Failed to register face. Please try again.",
        };
      }
    } catch (error: any) {
      console.error("Error calling face-recognition service:", error.message);
      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          message:
            "Could not connect to face recognition service. Please ensure it is running.",
        };
      }
      if (error.response?.data?.message) {
        return {
          success: false,
          message: error.response.data.message,
        };
      }
      return {
        success: false,
        message:
          "An error occurred while processing your face. Please try again.",
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
        message:
          "Face recognition service is currently offline. Please use email/password login.",
      };
    }

    try {
      const { createReadStream, filename } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append("image", stream, { filename });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/recognize-face`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 30000,
        }
      );

      const { status, user_id } = response.data;
      if (status === "success" && user_id) {
        const foundUser = await context.prisma.user.findUnique({
          where: { id: user_id },
        });

        if (!foundUser) {
          return {
            success: false,
            token: null,
            user: null,
            message:
              "Face recognized but user not found in database. Please contact support.",
          };
        }

        const mockToken = `authenticated-${foundUser.id}-${Date.now()}`;
        return {
          success: true,
          token: mockToken,
          user: foundUser,
          message: `Welcome back, ${foundUser.name || foundUser.email}!`,
        };
      } else {
        return {
          success: false,
          token: null,
          user: null,
          message:
            "Face not recognized. Please try again or use email/password login.",
        };
      }
    } catch (error: any) {
      console.error("Error during facial login:", error.message);
      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          token: null,
          user: null,
          message:
            "Could not connect to face recognition service. Please use email/password login.",
        };
      }
      return {
        success: false,
        token: null,
        user: null,
        message: "An error occurred during facial login. Please try again.",
      };
    }
  },

  removeFace: async (_: any, __: any, context: AppContext) => {
    if (!context.user) {
      throw new AuthenticationError(
        "You must be logged in to remove your face."
      );
    }
    return {
      success: false,
      message:
        "Remove face functionality not yet implemented in the face recognition service.",
    };
  },
};