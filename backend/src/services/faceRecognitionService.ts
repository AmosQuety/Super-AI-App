// src/services/faceRecognitionService.ts
import axios from "axios";
import FormData from "form-data";
import { Upload } from "../resolvers/types/upload"; // Ensure you have the Upload type defined
import { logger } from "../utils/logger";

// Point to your running Python FastAPI server
const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

export class FaceRecognitionService {
  
  /**
   * Ping the Python Service to see if it's alive
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/`);
      return { 
        isOnline: response.status === 200, 
        message: response.data.system || "Python Service Online",
        registeredFacesCount: 0 // You could add an endpoint in Python to get this count
      };
    } catch (error: any) {
      logger.error("❌ Python Face Service is OFFLINE", { error: error.message });
      return { isOnline: false, message: "Face Recognition Service Unavailable", registeredFacesCount: 0 };
    }
  }

  /**
   * Send image to Python for Registration (Enrollment)
   */
  async registerFace(userId: string, userName: string, image: Upload) {
    try {
      logger.info(`Attempting to register face for User ID: ${userId} (${userName})`);
      
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      // Prepare form data
      const formData = new FormData();
      // Python API expects 'name' and 'file'
      formData.append("name", userName); // We use the user's name (or ID) to label the face
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

      return { success: true, ...response.data };
    } catch (error: any) {
      logger.error("Face Registration Failed", { error: error.response?.data || error.message });
      throw new Error(error.response?.data?.detail || "Failed to register face");
    }
  }

  /**
   * Send image to Python for Verification (Login)
   */
  async verifyFace(image: Upload) {
    try {
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      // Python API expects 'file'
      formData.append("file", stream, { filename, contentType: mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/verify`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          validateStatus: (status) => status < 500, // Handle 401 (Denied) manually
        }
      );

      // The Python API returns:
      // 200 OK: { access: "GRANTED", user: "Jon Snow", ... }
      // 401 Unauthorized: { access: "DENIED", error: "...", ... }

      if (response.data.access === "GRANTED") {
        return {
          success: true,
          matchedUser: response.data.user, // The name stored in Python
          confidence: response.data.confidence,
          emotion: response.data.emotion_detected
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Face not recognized",
          emotion: response.data.message
        };
      }

    } catch (error: any) {
      logger.error("Face Verification Error", { error: error.message });
      throw new Error("Could not connect to biometric engine.");
    }
  }
}