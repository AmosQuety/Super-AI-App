// src/resolvers/types/context.ts 
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { FaceRecognitionService } from "../../services/faceRecognitionService";
import { OrchestratorAIService } from "../../services/ai/OrchestratorAIService";
import { ChatService } from "../../services/chatService";
import { UserService } from "../../services/userService";
import { MessageService } from "../../services/messageService";
import { UserRole } from "../../auth/authorization";
import { DataLoaderService } from "../../services/DataLoaderService";
import { DataLoaders } from '../../loaders/index';
import { logger } from '../../utils/logger';
import { TaskService } from "../../services/taskService";
import { PushNotificationService } from "../../services/pushNotificationService";

// ✅ CHANGED: Import Pollinations instead of HuggingFace
import { PollinationsService } from '../../services/pollinations.service'; 

import prisma from "../../lib/db";
import { JWTPayload, SecurityConfig } from "../../auth/security"; 

// ============================================
// SINGLETON SERVICES (Created once, reused)
// ============================================
const singletonServices = {
  faceRecognitionService: new FaceRecognitionService(),
  // ✅ REPLACED: OrchestratorAIService delegates to ChatOrchestrator internally.
  // The property name is preserved so all resolvers continue to work unchanged.
  geminiAIService: new OrchestratorAIService(),
  
  // ✅ CHANGED: Use Pollinations instead of HuggingFace
  // Both imageGenerationService and huggingFaceService point to the same Pollinations instance
  // This maintains backward compatibility with your existing code
  imageGenerationService: PollinationsService.getInstance(), 
  huggingFaceService: PollinationsService.getInstance(), // Same instance, different name for compatibility
  pushNotificationService: new PushNotificationService(prisma),
};

export interface Upload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => any;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role?: UserRole;
}

export interface AppContext {
  prisma: PrismaClient;
  user: JWTPayload | null;
  req: Request;
  res: Response;
 
  // Services
  faceRecognitionService: FaceRecognitionService;
  // ✅ REPLACED: Type updated to OrchestratorAIService.
  // Interface shape (generateContent, getEmbedding) is identical to the old GeminiAIService.
  geminiAIService: OrchestratorAIService;
  
  // ✅ CHANGED: Type is now PollinationsService
  // But we keep the same property names for backward compatibility
  imageGenerationService: PollinationsService; 
  huggingFaceService: PollinationsService;
  pushNotificationService: PushNotificationService;
  
  chatService: ChatService;
  userService: UserService;
  messageService: MessageService;
  taskService: TaskService;
  dataLoaderService: DataLoaderService;
  loaders: DataLoaders;
  pubsub?: any;
}

export const disconnectPrisma = async () => {
  await prisma.$disconnect();
};

// ============================================
// CONTEXT CREATION
// ============================================
export async function createContext({ req, connection }: any): Promise<AppContext> {
  let token: string | undefined;
  
  if (req) {
    token = req.headers.authorization?.replace("Bearer ", "");
    
  } else if (connection?.context?.authToken) {
    token = connection.context.authToken;
  }
  
  let user: JWTPayload | null = null;
  if (token) {
    try {
      user = SecurityConfig.verifyToken(token);
      logger.debug('[context] user authenticated');
    } catch (error) {
      logger.warn('[context] invalid or expired token');
    }
  }

  const requestServices = {
    chatService: new ChatService(prisma),
    userService: new UserService(prisma),
    messageService: new MessageService(prisma),
    taskService: new TaskService(prisma),
    dataLoaderService: new DataLoaderService(prisma),
    loaders: new DataLoaders(prisma),
  };

  return {
    prisma,
    user,
    req,
    res: req?.res,
    ...singletonServices,
    ...requestServices,
  };
}