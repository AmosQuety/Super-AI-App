// src/resolvers/queries/faceServiceQueries.ts
import { AppContext } from "../types/context";

export const faceServiceQueries = {
  faceServiceStatus: async (_: any, __: any, context: AppContext) => {
    const healthCheck = await context.faceRecognitionService.checkHealth();

    if (healthCheck.isOnline) {
      try {
        // Get registered users from the face service
        const registeredUserIds = await context.faceRecognitionService.getRegisteredUsers();
        
        // Count how many of these users exist in our database
        const registeredUsers = await context.prisma.user.findMany({
          where: {
            id: {
              in: registeredUserIds
            }
          }
        });

        return {
          isOnline: true,
          registeredFacesCount: registeredUsers.length,
          message: "Face recognition service is online and ready",
        };
      } catch (error) {
        console.error("Error getting registered faces count:", error);
        return {
          isOnline: true,
          registeredFacesCount: healthCheck.data?.known_faces_count || 0,
          message: "Face recognition service is online",
        };
      }
    } else {
      return {
        isOnline: false,
        registeredFacesCount: 0,
        message: "Face recognition service is offline. Please start the Python service.",
      };
    }
  },
};



