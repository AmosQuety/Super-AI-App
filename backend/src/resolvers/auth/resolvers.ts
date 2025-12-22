// src/resolvers/auth/resolvers.ts 
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SecurityConfig, JWTPayload } from "../../auth/security";
import { AuthorizationService, UserRole } from "../../auth/authorization";
import { AppContext } from "../types/context"; // Import the full AppContext

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

      if (!user) {
        // Use same error message to prevent email enumeration
        throw new AuthenticationError("Invalid email or password");
      }

      if (!user.password) {
        throw new AuthenticationError("Please use face authentication or set a password");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new AuthenticationError("Invalid email or password");
      }

      const token = SecurityConfig.createToken({
        userId: user.id,
        email: user.email,
        role: UserRole.USER,
      });

      const { password: userPassword, ...userWithoutPassword } = user;

      // Log login attempt (you'd add proper logging here)
      console.log(`User ${user.email} logged in successfully`);

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
  },

  User: {
    createdAt: (parent: User) => {
      return parent.createdAt ? new Date(parent.createdAt).toISOString() : null;
    },

    hasFaceRegistered: (parent: any) => {
      // Return the value directly from the database object
      return !!parent.hasFaceRegistered;
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
    console.error('Token authentication failed:', error);
    return null;
  }
};