// src/services/faceRecognitionService.ts
import axios from "axios";
import FormData from "form-data";
import http from "http";
import https from "https";
import crypto from "crypto";
import { Upload } from "../resolvers/types/upload"; 
import { logger } from "../utils/logger";

/** Generate a UUID v4 for idempotent outbound requests. */
const newRequestId = () => crypto.randomUUID();

const PYTHON_SERVICE_URL = process.env.PYTHON_FACE_SERVICE_URL || "http://127.0.0.1:8000";

const aiEngineClient = axios.create({
  baseURL: PYTHON_SERVICE_URL,
  httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
  httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
});

export class FaceRecognitionService {
  
  async checkHealth() {
    try {
      const response = await aiEngineClient.get(`/`, {
        timeout: 3000,  // 3s for health/status endpoints per spec
        headers: { 'x-request-id': newRequestId() },
      });
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

      const response = await aiEngineClient.post(
        `/register`,
        formData,
        {
          headers: { 
            ...formData.getHeaders(),
            "x-service-key": process.env.SERVICE_API_KEY,
            "x-request-id": newRequestId(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 15000, // 15s for face recognition endpoints per spec
        }
      );

      return { success: true, ...response.data };
    } catch (error: any) {
      logger.error("❌ Face Registration Failed", { 
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
        stack: error.stack
      });
      // Return a structured error so the resolver can handle it
      return { 
        success: false, 
        message: error.response?.data?.message || error.response?.data?.error || "Failed to register face" 
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

      const response = await aiEngineClient.post(
        `/verify`,
        formData,
        {
          headers: { 
            ...formData.getHeaders(),
            "x-service-key": process.env.SERVICE_API_KEY,
            "x-request-id": newRequestId(),
          },
          validateStatus: (status) => status < 500, // Handle 401s manually
          timeout: 15000, // 15s for face recognition endpoints per spec
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
      
      logger.error("❌ Face Verification Error", { 
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack
      });
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

      const response = await aiEngineClient.post(
        `/analyze`,
        formData,
        {
          headers: { 
            ...formData.getHeaders(),
            "x-service-key": process.env.SERVICE_API_KEY,
            "x-request-id": newRequestId(),
          },
          timeout: 15000, // 15s for face endpoints per spec
        }
      );

      return response.data; // { success: true, data: { age: 25, ... } }

    } catch (error: any) {
      //  Log the real error for you (The Developer)
      logger.error("❌ Face Analysis Internal Error", { 
        message: error.message,
        code: error.code,
        status: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack
      });

      //  Return a clean error for the USER
      if (error.code === 'ECONNREFUSED') {
        throw new Error("Biometric Engine is offline. Please start the Python server.");
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error("Analysis timed out. The model is loading, please try again in 10 seconds.");
      }
      
      //  Handle Python Exceptions (e.g. 500 or 400)
      if (error.response?.data?.error) {
         throw new Error(`AI Error: ${error.response.data.error}`);
      }

      throw new Error("Could not analyze face. Please ensure lighting is good.");
    
    }
  }

  async compareFaces(image1: Promise<Upload>, image2: Promise<Upload>) {
    try {
      const file1 = await image1;
      const file2 = await image2;

      const formData = new FormData();
      formData.append("file1", file1.createReadStream(), { filename: file1.filename, contentType: file1.mimetype });
      formData.append("file2", file2.createReadStream(), { filename: file2.filename, contentType: file2.mimetype });

      const response = await aiEngineClient.post(
        `/compare`,
        formData,
        {
         headers: { 
           ...formData.getHeaders(),
           "x-service-key": process.env.SERVICE_API_KEY,
           "x-request-id": newRequestId(),
         },
        maxContentLength: Infinity,
          maxBodyLength: Infinity,
         timeout: 15000, // 15s for face endpoints per spec
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

      const response = await aiEngineClient.post(
        `/find-face`,
        formData,
        {
          headers: { 
            ...formData.getHeaders(),
            "x-service-key": process.env.SERVICE_API_KEY,
            "x-request-id": newRequestId(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000 // 5 minutes for CPU-bound crowd operations
        }
      );

      return response.data;
    } catch (error: any) {
      // DEBUG LOGS
      logger.error("❌ Python API FindFace Error", {
        status: error.response?.status,
        responseData: error.response?.data,
        message: error.message,
        stack: error.stack
      });

      // Surfacing the detailed error from Python if available
      const pythonError = error.response?.data?.error || error.response?.data?.message;
      
      if (pythonError) {
        throw new Error(`Find Face Error: ${pythonError}`);
      }

      // Check for timeout
      if (error.code === 'ECONNABORTED') {
         throw new Error("Processing took too long. Try a smaller group photo.");
      }
      throw new Error("Find Face Error: " + error.message);
    }
  }
}