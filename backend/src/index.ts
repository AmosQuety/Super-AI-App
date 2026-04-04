// src/index.ts

import "./utils/sentry"; 
import * as Sentry from "@sentry/node";

// NOW import everything else
import * as dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response, NextFunction } from "express";
import { ApolloServer } from "apollo-server-express";
import prisma from "./lib/db";
import { GraphQLError } from 'graphql';
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
import { initAIOrchestrator, shutdownAIOrchestrator } from './bootstrap/aiOrchestrator';

console.log('DATABASE_URL:', process.env.DATABASE_URL);

// Constants for configuration
const UPLOAD_CONFIG = {
  maxFileSize: 3145728, // 3MB Limit to protect AI memory (approx 15-30 seconds audio)
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
    const isDev = process.env.NODE_ENV !== 'production';

    // 1. DYNAMIC CORS CONFIGURATION
    const allowedOrigins = [
      "https://prism-vision.vercel.app",
      "https://studio.apollographql.com",
      "https://sandbox.apollo.dev",
    ];

const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const isLocalhost = origin.startsWith('http://localhost') || 
                           origin.startsWith('http://127.0.0.1') ||
                           origin.startsWith('exp://'); // For Expo

        if (isLocalhost || allowedOrigins.indexOf(origin) !== -1 || isDev) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },

      credentials: true,
      methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
      allowedHeaders: [
        "Content-Type", 
        "Authorization", 
        "Apollo-Require-Preflight", 
        "x-apollo-operation-name",
        "apollographql-client-name"
      ],
    };

     // 2. APPLY CORS IMMEDIATELY (Before Rate Limiting)
    app.use(cors(corsOptions));
    app.options("*", cors(corsOptions)); // Handle preflight for all routes

    // 3. RATE LIMITING (Now safe because CORS headers are already set)
    RateLimitService.initializeRedis();
    app.use('/graphql', RateLimitService.getGraphQLLimiter());
    app.use('/auth/*', RateLimitService.getAuthLimiter());
    
    // 4. LOGGING & PARSING & WEBHOOKS
    app.use(loggingMiddleware);
    
    // Attach Webhooks early before generic GraphQL body parsing
    const { webhookRouter } = require('./services/webhooks');
    app.use('/api/webhooks', webhookRouter);

    app.use(express.json());

      

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


    // Helper to decide if error is safe to show
    const isExposedError = (code: string) => {
      return ['BAD_USER_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN', 'GRAPHQL_VALIDATION_FAILED', 'BAD_REQUEST'].includes(code);
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

    // 5. AI ORCHESTRATOR BOOTSTRAP
    await initAIOrchestrator();

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

    // Add this route before Apollo middleware
    app.get("/debug-tables", async (_req: Request, _res: Response) => {
      // const tables = await prisma.$queryRaw`SELECT ...`; 
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
      context: createContext,
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

      formatError: (error: GraphQLError) => {
        // Report to Sentry
        Sentry.captureException(error);

        const code = error.extensions?.code || 'INTERNAL_SERVER_ERROR';
        const originalError = error.originalError as any; 
        const errorId = originalError?.errorId || `err_${Date.now()}`;

        logger.error(`[${code}] ${error.message}`, {
          errorId,
          stack: originalError?.stack,
          path: error.path,
          locations: error.locations
        });

        if (process.env.NODE_ENV === 'production') {
          if (!isExposedError(code as string)) {
            return {
              message: "Internal Server Error",
              extensions: { 
                code: 'INTERNAL_SERVER_ERROR',
                errorId 
              }
            };
          }
        }

        return {
          message: error.message,
          locations: error.locations,
          path: error.path,
          extensions: {
            ...error.extensions,
            errorId
          }
        };
      },
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

    // Add Sentry debug endpoint
    app.get("/debug-sentry", function mainHandler(req, res) {
      throw new Error("My first Sentry error!");
    });

    // Apply Apollo middleware to Express
    apolloServerInstance.applyMiddleware({
      app,
      path: "/graphql",
      cors: false,
    });

    // Start the server
    const PORT = process.env.PORT || DEFAULT_PORT;

    // The Sentry error handler must be registered before any other error middleware and after all controllers
    Sentry.setupExpressErrorHandler(app);

    // Optional fallthrough error handler
    app.use(function onError(err: any, req: Request, res: Response, next: NextFunction) {
      // The error id is attached to `res.sentry` to be returned
      // and optionally displayed to the user for support.
      res.statusCode = 500;
      res.end((res as any).sentry + "\n");
    });

    httpServerInstance.listen(PORT, () => {
      logger.info(`
          🚀 GraphQL Server ready at http://localhost:${PORT}${apolloServerInstance.graphqlPath}
          🔌 Subscriptions ready at ws://localhost:${PORT}/graphql
          🔍 Apollo Sandbox available at http://localhost:${PORT}/graphql
          🏥 Health check available at http://localhost:${PORT}/health
          🐛 Sentry test endpoint at http://localhost:${PORT}/debug-sentry
      `);
      
      logger.info(`
          📊 Services Initialized:
          ✅ Database Service (Optimized with connection pooling)
          ✅ Security Services
          ✅ GraphQL Service
          ✅ WebSocket Service
          ✅ Singleton Services (Face Recognition, Gemini AI)
          ✅ Sentry Error Monitoring
      `);
    });

    return httpServerInstance;
  } catch (error) {
    Sentry.captureException(error);
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

// Rest of your shutdown handlers remain the same...
const shutdown = async (signal: string) => {
  logger.info(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  
  if (httpServerInstance) {
    httpServerInstance.close(async () => {
      logger.info('✅ HTTP server closed');
    });
  }

  try {
    if (subscriptionServerInstance) {
      subscriptionServerInstance.dispose();
      logger.info('✅ WebSocket subscriptions closed');
    }

    if (apolloServerInstance) {
      await apolloServerInstance.stop();
      logger.info('✅ Apollo Server stopped');
    }

    await disconnectPrisma();
    logger.info('✅ Shared Prisma client disconnected');

    await shutdownAIOrchestrator();

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', { error });
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown('SIGINT'));
process.on("SIGTERM", () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  shutdown('UNCAUGHT_EXCEPTION');
});

startServer().catch((error) => {
  logger.error('Failed to start server:', { error });
  process.exit(1);
});