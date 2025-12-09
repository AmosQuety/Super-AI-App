// src/index.ts 
import * as dotenv from "dotenv";
// Initialize environment variables
dotenv.config();
import express, { Application, Request, Response, NextFunction } from "express";
import { ApolloServer } from "apollo-server-express";
import { PrismaClient } from "@prisma/client";

import { graphqlUploadExpress } from "graphql-upload-minimal";
import { typeDefs } from "./schema/schema";
import { resolvers } from "./resolvers/index";
import cors from "cors";
import { createContext, disconnectPrisma } from "./resolvers/types/context";
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws'; 
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RateLimitService } from './auth/rate-limiting';
import { SecurityConfig } from './auth/security';
import { queryComplexityPlugin } from './utils/queryComplexityPlugin';
import { logger } from './utils/logger';
import { 
  loggingMiddleware, 
  graphQLLoggingMiddleware, 
  errorLoggingMiddleware,
  securityLoggingMiddleware,
  performanceMiddleware 
} from './middleware/logging';
import * as fs from 'fs';
import * as path from 'path';



// Initialize Prisma Client (this will be replaced by the shared instance in context)
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
console.log('Checking database at:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
  try {
    // Try to access the file
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    console.log('✅ Database file is readable and writable');
  } catch (err) {
    console.error('❌ Cannot access database file:', err);
  }
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Constants for configuration
const UPLOAD_CONFIG = {
  maxFileSize: 10000000, // 10MB
  maxFiles: 10,
};

const DEFAULT_PORT = 4001;

// Store server instances for graceful shutdown
let httpServerInstance: any;
let apolloServerInstance: ApolloServer;
let subscriptionServerInstance: any;

const startServer = async (): Promise<any> => {
  try {
    const app: Application = express();

    // Validate security configuration on startup
    try {
      SecurityConfig.getJWTConfig();
      logger.info("✅ Security configuration validated");
    } catch (error: any) {
      logger.error("❌ Security configuration error:", { error: error.message });
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // Configure CORS
    const corsOptions = {
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "exp://localhost:8081",

         "http://10.117.54.213:5173", 
        "http://10.117.54.213:3000",

        // Add Apollo Studio domains
        "https://studio.apollographql.com",
        "https://sandbox.apollo.dev",
      ],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Apollo-Require-Preflight",
        "apollographql-client-name",
        "apollographql-client-version",
      ],
    };

    app.options("*", cors(corsOptions));
    app.use(cors(corsOptions));

    // Initialize and apply rate limiting
    RateLimitService.initializeRedis();
    app.use('/graphql', RateLimitService.getGraphQLLimiter());
    app.use('/auth/*', RateLimitService.getAuthLimiter());
    app.use('/health', RateLimitService.getGeneralLimiter());

    // Apply logging middleware
    app.use(loggingMiddleware);
    app.use(graphQLLoggingMiddleware);
    app.use(securityLoggingMiddleware);
    app.use(performanceMiddleware);

    // JSON body parser
    app.use(express.json());

    // Debug middleware to log upload requests
    app.use('/graphql', (req: Request, _res: Response, next: NextFunction) => {
      if (req.method === 'POST') {
        console.log('📨 Incoming GraphQL request:', {
          contentType: req.headers['content-type'],
          hasBody: !!req.body,
          isMultipart: req.headers['content-type']?.includes('multipart/form-data'),
        });
      }
      next();
    });

    // GraphQL upload middleware
    app.use(graphqlUploadExpress(UPLOAD_CONFIG));

    app.use(errorLoggingMiddleware);

    // Add this route to your Express app (before Apollo middleware)
    app.get("/debug-tables", async (_req: Request, res: Response) => {
      try {
        const tables = await prisma.$queryRaw`
          SELECT name FROM sqlite_master WHERE type='table'
        `;
        
        res.json({
          success: true,
          tables: tables,
          database: process.env.DATABASE_URL
        });
      } catch (error: any) {
        res.json({ 
          success: false,
          error: error.message 
        });
      }
    });

    app.get("/debug-db-location", async (_req: Request, res: Response) => {
      const fs = require('fs');
      const path = require('path');
      
      const possiblePaths = [
        path.join(__dirname, '../../dev.db'), // ../dev.db from src directory
        path.join(__dirname, '../../prisma/dev.db'), // prisma/dev.db from src directory
        path.join(process.cwd(), '../dev.db'), // ../dev.db from backend root
        path.join(process.cwd(), 'prisma/dev.db'), // prisma/dev.db from backend root
      ];
      
      const results = possiblePaths.map(dbPath => ({
        path: dbPath,
        exists: fs.existsSync(dbPath),
        absolute: path.resolve(dbPath)
      }));
      
      res.json({
        currentWorkingDir: process.cwd(),
        envDatabaseUrl: process.env.DATABASE_URL,
        databaseLocations: results
      });
    });


    // CREATE EXECUTABLE SCHEMA
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    // Add this validation before Apollo Server creation
    try {
      console.log("🔍 Validating schema and resolvers...");
      makeExecutableSchema({ 
        typeDefs, 
        resolvers 
      });
      console.log("✅ Schema validation passed");
    } catch (schemaError) {
      console.error("❌ SCHEMA VALIDATION ERROR:", schemaError);
      process.exit(1);
    }

    // Initialize Apollo Server with optimized context
    apolloServerInstance = new ApolloServer({
      schema,
      context: createContext, // Uses the optimized createContext with singleton services
      csrfPrevention: true,
      introspection: process.env.NODE_ENV !== 'production',
      cache: 'bounded',
      plugins: [
        queryComplexityPlugin,
        {
          async serverWillStart() {
            return {
              async drainServer() {
                if (subscriptionServerInstance) {
                  subscriptionServerInstance.dispose();
                }
              }
            };
          }
        }
      ],
      formatError: (error) => {
        logger.error('GraphQL Error', { error });
        
        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production' && !error.extensions?.code) {
          return new Error('Internal server error');
        }
        
        return error;
      }
    });

    // Start Apollo Server
    await apolloServerInstance.start();

    // Create HTTP server for WebSocket support
    httpServerInstance = createServer(app);

    // Create WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServerInstance,
      path: '/graphql',
    });

    // Use the WebSocket server with GraphQL
    subscriptionServerInstance = useServer(
      {
        schema,
        context: async (ctx) => {
          // Use the same optimized createContext function for consistency
          return createContext({ connection: ctx });
        },
        onConnect: () => {
          logger.info('🔌 WebSocket client connected');
        },
        onDisconnect: (_ctx: any, code?: number, reason?: string) => {
          logger.info('🔌 WebSocket client disconnected', { code, reason });
        },
      },
      wsServer
    );

    // Enhanced health check endpoint
    app.get("/health", async (_req: Request, res: Response) => {
      try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;
        
        res.json({ 
          status: "OK", 
          timestamp: new Date().toISOString(),
          services: {
            database: "healthy",
            security: "configured"
          },
          environment: process.env.NODE_ENV || "development"
        });
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({ 
          status: "ERROR", 
          timestamp: new Date().toISOString(),
          error: "Service unavailable" 
        });
      }
    });

    // Add a root endpoint
    app.get("/", (_req: Request, res: Response) => {
      res.json({
        message: "GraphQL Server is running",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        graphql: `http://localhost:${process.env.PORT || DEFAULT_PORT}/graphql`,
        subscriptions: `ws://localhost:${process.env.PORT || DEFAULT_PORT}/graphql`,
        health: `http://localhost:${process.env.PORT || DEFAULT_PORT}/health`
      });
    });

    // Apply Apollo middleware to Express
    apolloServerInstance.applyMiddleware({
      app,
      path: "/graphql",
      cors: false,
    });

    // Start the server
    const PORT = process.env.PORT || DEFAULT_PORT;

    httpServerInstance.listen(PORT, () => {
      logger.info(`
          🚀 GraphQL Server ready at http://localhost:${PORT}${apolloServerInstance.graphqlPath}
          🔌 Subscriptions ready at ws://localhost:${PORT}/graphql
          🔍 Apollo Sandbox available at http://localhost:${PORT}/graphql
          🏥 Health check available at http://localhost:${PORT}/health
      `);
      
      logger.info(`
          📊 Services Initialized:
          ✅ Database Service (Optimized with connection pooling)
          ✅ Security Services
          ✅ GraphQL Service
          ✅ WebSocket Service
          ✅ Singleton Services (Face Recognition, Gemini AI)
      `);
    });

    return httpServerInstance;
  } catch (error) {
  console.error("❌ CRITICAL SERVER STARTUP ERROR:");
  console.error("Full error:", error);
  
  if (error instanceof Error) {
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
  
  logger.error("Error starting server:", { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
}
};

// ============================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================
const shutdown = async (signal: string) => {
  logger.info(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  
  // Prevent new connections
  if (httpServerInstance) {
    httpServerInstance.close(async () => {
      logger.info('✅ HTTP server closed');
    });
  }

  try {
    // 1. Stop WebSocket subscriptions
    if (subscriptionServerInstance) {
      subscriptionServerInstance.dispose();
      logger.info('✅ WebSocket subscriptions closed');
    }

    // 2. Stop Apollo Server
    if (apolloServerInstance) {
      await apolloServerInstance.stop();
      logger.info('✅ Apollo Server stopped');
    }

    // 3. Disconnect shared Prisma client from context
    await disconnectPrisma();
    logger.info('✅ Shared Prisma client disconnected');

    // 4. Close the local Prisma instance used for health checks
    await prisma.$disconnect();
    logger.info('✅ Health check Prisma client disconnected');

    // 5. Close Redis connection (if RateLimitService exposes a method)
    // Note: You may need to add a shutdown method to RateLimitService
    // RateLimitService.shutdown();
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', { error });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGINT", () => shutdown('SIGINT'));
process.on("SIGTERM", () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  shutdown('UNCAUGHT_EXCEPTION');
});

// Start the application
startServer().catch((error) => {
  logger.error('Failed to start server:', { error });
  process.exit(1);
});