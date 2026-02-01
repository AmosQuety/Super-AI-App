// src/resolvers/types/context.ts 
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { FaceRecognitionService } from "../../services/faceRecognitionService";
import { GeminiAIService } from "../../services/geminiAIService";
import { ChatService } from "../../services/chatService";
import { UserService } from "../../services/userService";
import { MessageService } from "../../services/messageService";
import { UserRole } from "../../auth/authorization";
import { DataLoaderService } from "../../services/DataLoaderService";
import { DataLoaders } from '../../loaders/index';

// ✅ CHANGED: Import Pollinations instead of HuggingFace
import { PollinationsService } from '../../services/pollinations.service'; 

import prisma from "../../lib/db";
import { JWTPayload, SecurityConfig } from "../../auth/security"; 

// ============================================
// SINGLETON SERVICES (Created once, reused)
// ============================================
const singletonServices = {
  faceRecognitionService: new FaceRecognitionService(),
  geminiAIService: new GeminiAIService(),
  
  // ✅ CHANGED: Use Pollinations instead of HuggingFace
  // Both imageGenerationService and huggingFaceService point to the same Pollinations instance
  // This maintains backward compatibility with your existing code
  imageGenerationService: PollinationsService.getInstance(), 
  huggingFaceService: PollinationsService.getInstance(), // Same instance, different name for compatibility
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
  geminiAIService: GeminiAIService;
  
  // ✅ CHANGED: Type is now PollinationsService
  // But we keep the same property names for backward compatibility
  imageGenerationService: PollinationsService; 
  huggingFaceService: PollinationsService;
  
  chatService: ChatService;
  userService: UserService;
  messageService: MessageService;
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
      console.log('✅ User authenticated:', user.role);
    } catch (error) {
      console.warn("Invalid or expired token");
    }
  }

  const requestServices = {
    chatService: new ChatService(prisma),
    userService: new UserService(prisma),
    messageService: new MessageService(prisma),
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