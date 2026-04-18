// src/resolvers/auth/resolvers.ts 
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SecurityConfig, JWTPayload } from "../../auth/security";
import { AuthorizationService, UserRole } from "../../auth/authorization";
import { AppContext } from "../types/context"; // Import the full AppContext
import { VoiceCloningService } from "../../services/voiceCloningService";
import { redisClient } from "../../lib/redis";
import { logger } from "../../utils/logger";

const voiceCloningService = new VoiceCloningService();

// Pre-generated bcrypt hash (cost factor 12) used purely for timing parity.
// Ensures bcrypt.compare() always runs even for non-existent users,
// preventing response-time-based email enumeration.
// This is NOT a secret — it is a public dummy value, intentionally not in .env.
const DUMMY_HASH = "$2a$12$R.v5u01w1R.yA1eQJQ1K.OB37P4vL1kH02Q4iJw8A9H6pM9.D3PGO";

// Use the full AppContext instead of limited AuthContext
type UserResponse = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  role?: string;
  avatarUrl?: string | null;
  lastLoginAt?: Date | null;
  isActive?: boolean;
  updatedAt?: Date;
};

export const authResolvers = {
  Query: {
    me: async (_: any, __: any, context: AppContext): Promise<UserResponse> => {
      const user = AuthorizationService.requireAuth(context);

      const dbUser = await context.prisma.user.findUnique({
        where: { id: user.userId},
      });

      if (!dbUser) {
        throw new AuthenticationError("User not found");
      }

      const { password, ...userWithoutPassword } = dbUser;
      return userWithoutPassword;
    },

    users: async (_: any, __: any, context: AppContext): Promise<UserResponse[]> => {
      AuthorizationService.requireRole(context, UserRole.ADMIN);

      const users = await context.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          // Remove updatedAt since it's not in your schema
        },
      });

      return users;
    },

    getVoiceLoginChallenge: async (_: any, { email }: { email: string }, context: AppContext): Promise<string> => {
      if (!email) throw new UserInputError("Email is required");
      
      const user = await context.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { hasVoiceRegistered: true, id: true }
      });

      if (!user || !user.hasVoiceRegistered) {
        // Identical response regardless of which condition failed — prevents enumeration
        throw new UserInputError(
          "If this account exists and is enrolled, a voice challenge has been queued."
        );
      }

      // Check rate limit for challenge generation
      if (redisClient) {
        const lockoutKey = `voice_lockout:${user.id}`;
        const isLocked = await redisClient.get(lockoutKey);
        if (isLocked) {
          throw new AuthenticationError("Account temporarily locked due to multiple failed voice login attempts. Please try again later.");
        }
      }

      // Generate a random 6-digit challenge code
      const challenge = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in Redis with 60s TTL
      if (redisClient) {
        const challengeKey = `voice_challenge:${user.id}`;
        await redisClient.setex(challengeKey, 60, challenge);
      }

      return challenge;
    },

    securityAuditLogs: async (_: any, { userId, limit }: { userId?: string, limit?: number }, context: AppContext): Promise<any[]> => {
      const currentUser = AuthorizationService.requireAuth(context);
      
      // If not admin, only show own logs
      const finalUserId = currentUser.role === UserRole.ADMIN ? userId : currentUser.userId;

      const logs = await context.prisma.securityAuditLog.findMany({
        where: finalUserId ? { userId: finalUserId } : {},
        orderBy: { createdAt: "desc" },
        take: limit || 50,
      });

      return logs;
    },
  },

  Mutation: {
    register: async (
      _: any,
      args: { email: string; password: string; name?: string },
      context: AppContext
    ): Promise<{ user: UserResponse; token: string }> => {
      const { email, password, name } = args;

      // Enhanced validation
      if (!email || !password) {
        throw new UserInputError("Email and password are required");
      }

      if (password.length < 8) {
        throw new UserInputError("Password must be at least 8 characters long");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new UserInputError("Invalid email format");
      }

      const existingUser = await context.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new UserInputError("A user with this email already exists");
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await context.prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          name: name?.trim() || email.split('@')[0],
        },
      });

      const token = SecurityConfig.createToken({
        userId: user.id,
        email: user.email,
        role: UserRole.USER,
      });

      const { password: userPassword, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token,
      };
    },

    login: async (
      _: any,
      args: { email: string; password: string },
      context: AppContext
    ): Promise<{ user: UserResponse; token: string }> => {
      const { email, password } = args;

      if (!email || !password) {
        throw new UserInputError("Email and password are required");
      }

      const user = await context.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      const isValidPassword = await bcrypt.compare(
        password,
        user?.password || DUMMY_HASH
      );
      if (!user || !user.password || !isValidPassword) {
        throw new AuthenticationError("Invalid email or password");
      }

      const token = SecurityConfig.createToken({
        userId: user.id,
        email: user.email,
        role: UserRole.USER,
      });

      const { password: userPassword, ...userWithoutPassword } = user;

      // Log login attempt
      logger.info(`User ${user.email} logged in successfully`);

      return {
        user: userWithoutPassword,
        token,
      };
    },

    updateProfile: async (
      _: any,
      args: { name?: string; email?: string },
      context: AppContext
    ): Promise<UserResponse> => {
      const user = AuthorizationService.requireAuth(context);

      const updateData: any = {};
      if (args.name !== undefined) updateData.name = args.name.trim();
      if (args.email !== undefined) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
          throw new UserInputError("Invalid email format");
        }
        
        // Check if email is already taken by another user
        const existingUser = await context.prisma.user.findUnique({
          where: { email: args.email.toLowerCase().trim() },
        });
        
        if (existingUser && existingUser.id !== user.userId) {
          throw new UserInputError("Email is already taken");
        }
        
        updateData.email = args.email.toLowerCase().trim();
      }

      const updatedUser = await context.prisma.user.update({
        where: { id: user.userId},
        data: updateData,
      });

      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    },

    changePassword: async (
      _: any,
      args: { currentPassword: string; newPassword: string },
      context: AppContext
    ): Promise<{ success: boolean; message: string }> => {
      const user = AuthorizationService.requireAuth(context);

      const { currentPassword, newPassword } = args;

      if (newPassword.length < 8) {
        throw new UserInputError("New password must be at least 8 characters long");
      }

      const dbUser = await context.prisma.user.findUnique({
        where: { id: user.userId},
      });

      if (!dbUser) {
        throw new AuthenticationError("User not found");
      }

      if (!dbUser.password) {
        throw new AuthenticationError("No password set for this account");
      }

      const isValidPassword = await bcrypt.compare(currentPassword, dbUser.password);
      if (!isValidPassword) {
        throw new AuthenticationError("Current password is incorrect");
      }

      // Prevent reusing the same password
      const isSamePassword = await bcrypt.compare(newPassword, dbUser.password);
      if (isSamePassword) {
        throw new UserInputError("New password must be different from current password");
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      await context.prisma.user.update({
        where: { id: user.userId},
        data: { password: hashedNewPassword },
      });

      return {
        success: true,
        message: "Password updated successfully",
      };
    },

    loginWithVoice: async (
      _: any,
      args: { email: string; challengeCode: string; audio: Promise<any> },
      context: AppContext
    ): Promise<{ user: UserResponse; token: string }> => {
      const { email, challengeCode, audio } = args;

      if (!email || !challengeCode || !audio) {
        throw new UserInputError("Email, challenge code, and audio recording are required");
      }

      const user = await context.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        throw new AuthenticationError("User not found");
      }

      if (!user.hasVoiceRegistered) {
        throw new AuthenticationError("Voice profile not found for this account");
      }

      if (redisClient) {
        const lockoutKey = `voice_lockout:${user.id}`;
        const isLocked = await redisClient.get(lockoutKey);
        if (isLocked) {
          throw new AuthenticationError("Account temporarily locked due to multiple failed voice login attempts.");
        }

        const challengeKey = `voice_challenge:${user.id}`;
        const storedChallenge = await redisClient.get(challengeKey);
        
        if (!storedChallenge) {
          throw new AuthenticationError("Challenge expired. Please request a new challenge code.");
        }
        
        if (storedChallenge !== challengeCode) {
           throw new AuthenticationError("Invalid challenge code sequence provided.");
        }
        
        // Invalidate challenge immediately to prevent replay
        await redisClient.del(challengeKey);
      }

      // Verify voice with Python AI Engine (Embedding + STT)
      const result = await voiceCloningService.verifyVoice(user.id, challengeCode, audio);

      if (!result.success) {
        // Handle Rate Limiting
        if (redisClient) {
           const attemptsKey = `voice_attempts:${user.id}`;
           const attempts = await redisClient.incr(attemptsKey);
           if (attempts === 1) {
              await redisClient.expire(attemptsKey, 600); // 10 mins window
           }
           
           if (attempts >= 5) {
              // Lock account for 15 mins
              await redisClient.setex(`voice_lockout:${user.id}`, 900, "locked");
              await context.prisma.securityAuditLog.create({
                 data: {
                    userId: user.id,
                    userEmail: user.email,
                    event: "ACCOUNT_LOCKED",
                    details: JSON.stringify({ reason: "Max voice attempts exceeded", attempts }),
                 }
              });
              throw new AuthenticationError("Too many failed attempts. Account locked for 15 minutes.");
           }
        }
        
        await context.prisma.securityAuditLog.create({
           data: {
              userId: user.id,
              userEmail: user.email,
              event: "VOICE_LOGIN_FAILED",
              details: JSON.stringify({ error: result.error, similarity: result.similarity }),
           }
        });

        throw new AuthenticationError(result.error || "Voice verification failed");
      }

      // Success Path
      if (redisClient) {
         await redisClient.del(`voice_attempts:${user.id}`); // reset attempts
      }

      await context.prisma.securityAuditLog.create({
         data: {
            userId: user.id,
            userEmail: user.email,
            event: "VOICE_LOGIN_SUCCESS",
            details: JSON.stringify({ similarity: result.similarity }),
         }
      });

      // Generate Token
      const token = SecurityConfig.createToken({
        userId: user.id,
        email: user.email,
        role: UserRole.USER,
      });

      const { password, ...userWithoutPassword } = user;

      logger.info(`User ${user.email} logged in successfully via Voice Identity`);

      return {
        user: userWithoutPassword,
        token,
      };
    },
  },

  User: {
    createdAt: (parent: User) => {
      return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
    },

    hasFaceRegistered: (parent: any) => {
      // Return the value directly from the database object
      return !!parent.hasFaceRegistered;
    },

    hasVoiceRegistered: (parent: any) => {
      return !!parent.hasVoiceRegistered;
    },
  },

  SecurityAuditLog: {
    createdAt: (parent: any) => {
      return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
    },
  },
};

export const authenticateToken = async (prisma: PrismaClient, token: string) => {
  try {
    const payload = SecurityConfig.verifyToken(token) as JWTPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        createdAt: true,
        // Add role when you implement it in your schema
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      role: payload.role, // Include role from token
    };
  } catch (error) {
    logger.error('Token authentication failed:', error);
    return null;
  }
};