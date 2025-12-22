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
import { ImageGenerationService } from "../../services/imageGenerationService";
import { HuggingFaceService } from '../../services/huggingface.service'; 
import prisma from "../../lib/db";
import {JWTPayload, SecurityConfig } from "../../auth/security"; 

// ============================================
// SINGLETON SERVICES (Created once, reused)
// ============================================
// These services don't depend on prisma or request-specific data
// They're initialized once when the module loads and reused for all requests
const singletonServices = {
  faceRecognitionService: new FaceRecognitionService(),
  geminiAIService: new GeminiAIService(),
  imageGenerationService: new ImageGenerationService(),
  huggingFaceService: HuggingFaceService.getInstance(), // Add this - use getInstance() for singleton
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
  imageGenerationService: ImageGenerationService;
  huggingFaceService: HuggingFaceService; // Add this
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
  
  // Handle both HTTP and WebSocket connections
  if (req) {
    // HTTP request
    token = req.headers.authorization?.replace("Bearer ", "");
  } else if (connection?.context?.authToken) {
    // WebSocket connection
    token = connection.context.authToken;
  }
  
  // Authenticate user
  let user: JWTPayload | null = null;
  if (token) {
    try {
      user = SecurityConfig.verifyToken(token);
    } catch (error) {
      // Invalid token/ token expired, user remains null
      console.warn("Invalid or expired token");

    }
    
    
  }

  // Create request-specific services
  // These are created fresh for each request because they depend on prisma
  // or might have request-specific state
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
    res: req ?.res,
    ...singletonServices,
    ...requestServices,
  };
}