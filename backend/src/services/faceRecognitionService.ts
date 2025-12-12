// src/services/faceRecognitionService.ts
import axios from "axios";
import FormData from "form-data";
import { Upload } from "../resolvers/types/upload"; 
import { logger } from "../utils/logger";

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

export class FaceRecognitionService {
  
  async checkHealth() {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/`, { timeout: 2000 });
      return { 
        isOnline: response.status === 200, 
        message: response.data.system || "Python Service Online",
        registeredFacesCount: 0 
      };
    } catch (error: any) {
      // Don't log full error stack for health checks to keep logs clean
      return { isOnline: false, message: "Face Recognition Service Unavailable", registeredFacesCount: 0 };
    }
  }

  /**
   * Register a face (Accepts Promise<Upload>)
   */
  async registerFace(
    userId: string, 
    workspaceId: string, 
    characterName: string, 
    image: Promise<Upload> // <--- CHANGED TYPE HERE
  ) {
    try {
      logger.info(`Sending face to Python: User=${userId}, Workspace=${workspaceId}, Name=${characterName}`);

      // Await the upload promise here
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("workspace_id", workspaceId);
      formData.append("name", characterName);
      formData.append("file", stream, { filename, contentType: mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/register`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000, // 60s for model loading
        }
      );

      return { success: true, ...response.data };
    } catch (error: any) {
      logger.error("Face Registration Failed", { error: error.response?.data || error.message });
      // Return a structured error so the resolver can handle it
      return { 
        success: false, 
        message: error.response?.data?.message || "Failed to register face" 
      };
    }
  }

  /**
   * Verify a face (Accepts Promise<Upload>)
   */
  async verifyFace(
    userId: string, 
    workspaceId: string, 
    image: Promise<Upload> // <--- CHANGED TYPE HERE
  ) {
    try {
      // Await the upload promise here
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("workspace_id", workspaceId);
      formData.append("file", stream, { filename, contentType: mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/verify`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          validateStatus: (status) => status < 500, // Handle 401s manually
          timeout: 60000, // 60s
        }
      );

      const { access, user, emotion_detected, error, message } = response.data;

      if (access === "GRANTED") {
        return {
          success: true,
          matchedUser: user, 
          confidence: response.data.confidence,
          emotion: emotion_detected
        };
      } else {
        return {
          success: false,
          error: error || "Face not recognized",
          emotion: message // Contains "User looked 'fear'" etc.
        };
      }

    } catch (error: any) {
      // Check for timeout
      if (error.code === 'ECONNABORTED') {
         logger.error("❌ Python Service Timed Out");
         return { success: false, error: "Service warming up, please try again." };
      }
      
      logger.error("Face Verification Error", { error: error.message });
      throw new Error("Could not connect to biometric engine.");
    }
  }

  /**
   * Phase 2: Magic Mirror Analysis
   */
  async analyzeFace(image: Promise<Upload>) {
    try {
      const { createReadStream, filename, mimetype } = await image;
      const stream = createReadStream();

      const formData = new FormData();
      formData.append("file", stream, { filename, contentType: mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/analyze`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 60000, 
        }
      );

      return response.data; // { success: true, data: { age: 25, ... } }

    } catch (error: any) {
      logger.error("Face Analysis Error", { error: error.message });
      throw new Error("Could not analyze face.");
    }
  }

  async compareFaces(image1: Promise<Upload>, image2: Promise<Upload>) {
    try {
      const file1 = await image1;
      const file2 = await image2;

      const formData = new FormData();
      formData.append("file1", file1.createReadStream(), { filename: file1.filename, contentType: file1.mimetype });
      formData.append("file2", file2.createReadStream(), { filename: file2.filename, contentType: file2.mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/compare`,
        formData,
        {
         headers: { ...formData.getHeaders()  },
        maxContentLength: Infinity,
          maxBodyLength: Infinity,
         timeout: 60000,
        }
      );

      return response.data;
    } catch (error: any) {
      throw new Error("Comparison failed: " + error.message);
    }
  }

  
  /**
   * Experiment 3: Find Me in Crowd
   */
  async findFaceInCrowd(target: Promise<Upload>, crowd: Promise<Upload>) {
    try {
      const file1 = await target;
      const file2 = await crowd;

      const formData = new FormData();
      formData.append("target", file1.createReadStream(), { filename: file1.filename, contentType: file1.mimetype });
      formData.append("crowd", file2.createReadStream(), { filename: file2.filename, contentType: file2.mimetype });

      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/find-face`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 120000 // <--- Give it 2 minutes (Group photos are heavy!)
        }
      );

      return response.data;
    } catch (error: any) {
      // Check for timeout
      if (error.code === 'ECONNABORTED') {
         throw new Error("Processing took too long. Try a smaller group photo.");
      }
      throw new Error("Find Face Error: " + error.message);
    }
  }
}