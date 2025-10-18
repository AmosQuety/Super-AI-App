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
  chatService: ChatService;
  userService: UserService;
  messageService: MessageService;
  dataLoaderService: DataLoaderService;
  loaders: DataLoaders;
  pubsub?: any;
}

// ============================================
// SINGLETON SERVICES (Created once, reused)
// ============================================
// These services don't depend on prisma or request-specific data
// They're initialized once when the module loads and reused for all requests
const singletonServices = {
  faceRecognitionService: new FaceRecognitionService(),
  geminiAIService: new GeminiAIService(),
   imageGenerationService: new ImageGenerationService(),
};

// ============================================
// SHARED PRISMA CLIENT (Optional but recommended)
// ============================================
// Creating a new PrismaClient on every request is expensive
// Better to reuse a single instance
let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    console.log('🔧 Creating new Prisma Client with URL:', process.env.DATABASE_URL);
    
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
    });
    
    // Test the connection immediately
    prismaInstance.$connect()
      .then(() => console.log('✅ Prisma connected successfully'))
      .catch((err) => console.error('❌ Prisma connection failed:', err));
  }
  return prismaInstance;
}

// Graceful shutdown handler
export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// ============================================
// CONTEXT CREATION
// ============================================
export async function createContext({ req, connection }: any): Promise<AppContext> {
  // Reuse the same Prisma client across all requests
  const prisma = getPrismaClient();
  
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
    // Spread singleton services (reused across requests)
    ...singletonServices,
    // Spread request-specific services (new for each request)
    ...requestServices,
  };
}