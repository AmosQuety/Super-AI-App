// src/resolvers/queries/faceServiceQueries.ts
import { AppContext } from "../types/context";
import axios from "axios";

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

export const faceServiceQueries = {
  faceServiceStatus: async (_: any, __: any, context: AppContext) => {
    try {
      // Check root endpoint
      const response = await axios.get(`${PYTHON_SERVICE_URL}/`, { timeout: 2000 });
      
      // Calculate how many users have Face ID enabled in our database
      const facesInDb = await context.prisma.user.count({
        where: { hasFaceRegistered: true }
      });

      if (response.status === 200) {
        return {
          isOnline: true,
          registeredFacesCount: facesInDb,
          message: `Biometric Engine Online. System: ${response.data.system}`,
        };
      } else {
        throw new Error("Service returned non-200 status");
      }
    } catch (error) {
      return {
        isOnline: false,
        registeredFacesCount: 0,
        message: "Biometric Engine is OFFLINE. Please check server logs.",
      };
    }
  },
};