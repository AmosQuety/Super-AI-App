// src/resolvers/types/context.ts 
import { PrismaClient } from "@prisma/client";
import { FaceRecognitionService } from "../../services/faceRecognitionService";
import { GeminiAIService } from "../../services/geminiAIService";
import { ChatService } from "../../services/chatService";
import { UserService } from "../../services/userService";
import { MessageService } from "../../services/messageService";
import { authenticateToken } from "../auth/resolvers";
import { UserRole } from "../../auth/authorization";
import { DataLoaderService } from "../../services/DataLoaderService";
import { DataLoaders } from '../../loaders/index';
import { ImageGenerationService } from "../../services/imageGenerationService";
import { HuggingFaceService } from '../../services/huggingface.service'; // Add this import
import prisma from "../../lib/db";

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
  user: AuthenticatedUser | null;
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
  let user: AuthenticatedUser | null = null;
  if (token) {
    // Pass the singleton prisma to the auth function
    const rawUser = await authenticateToken(prisma, token);
    if (rawUser) {
      user = {
        id: rawUser.id,
        email: rawUser.email,
        role: rawUser.role as UserRole,
      };
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
    ...singletonServices,
    ...requestServices,
  };
}