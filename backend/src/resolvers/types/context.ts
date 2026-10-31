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
import { JWTPayload } from "../../auth/security";
import { authenticateToken, AccountLookup } from "../../auth/sessionUser"; 

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
// `password` (the hash) is read only to compare the token's password fingerprint.
export const accountLookupFor =
  (db: Pick<PrismaClient, "user">): AccountLookup =>
  (userId) =>
    db.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true, password: true, sessionVersion: true } });

const lookupStoredAccount = accountLookupFor(prisma);

// A WebSocket operation has no Express request, but the limits and the audit trail need to know
// who is calling. The socket's address is the same address an HTTP request would report when no
// proxy is trusted. With a trusted proxy the caller passes `resolveAddress`, so the address is
// worked out by the same rule as for HTTP.
function clientInfoFromConnection(
  connection: any,
  resolveAddress?: (request: any) => string | undefined,
): any {
  const request = connection?.extra?.request;
  return {
    ip: resolveAddress ? resolveAddress(request) : request?.socket?.remoteAddress,
    headers: request?.headers ?? {},
  };
}

export async function createContext({
  req,
  connection,
  resolveAddress,
  lookupAccount = lookupStoredAccount,
}: any): Promise<AppContext> {
  let token: string | undefined;

  if (req) {
    token = req.headers.authorization?.replace("Bearer ", "");
  } else if (connection?.connectionParams?.authToken) {
    // graphql-ws delivers the client's connection params here
    token = connection.connectionParams.authToken;
  }

  const user: JWTPayload | null = await authenticateToken(token, lookupAccount);

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
    req: req ?? clientInfoFromConnection(connection, resolveAddress),
    res: req?.res,
    ...singletonServices,
    ...requestServices,
  };
}