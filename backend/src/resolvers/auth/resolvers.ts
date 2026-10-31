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
import { assertPasswordWithinByteLimit } from "../../auth/passwordPolicy";
import { closeUserSockets } from "../../auth/socketRegistry";
import { recordAccountEvent } from "../../auth/accountAudit";
import { verifyCurrentPassword } from "../../auth/currentPassword";
import { MAX_EMAIL_LENGTH, markSignInSucceeded, reserveSignIn } from "../../auth/signInAttempts";
import { recordSignInFailure } from "../../auth/signInFailure";
import { countSecurityEvent } from "../../utils/securityMetrics";
import { clearFailedAttempts, reserveAttempt } from "../../auth/passwordAttempts";

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

// A new email address changes how the account is recovered, so a stolen session alone must not be
// enough: the current password is required. Sending the address already on file changes nothing.
async function validatedNewEmail(
  context: AppContext,
  account: User,
  args: { email?: string | null; currentPassword?: string | null }
): Promise<string> {
  const email = (args.email ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserInputError("Invalid email format");
  }
  if (email === account.email.toLowerCase().trim()) return email;

  // An account with no password (none are known to exist) has nothing to confirm.
  if (account.password) {
    if (!args.currentPassword) {
      throw new UserInputError("Enter your current password to change your email");
    }
    await verifyCurrentPassword(context, { ...account, password: account.password }, args.currentPassword, "change_email");
  }

  const existingUser = await context.prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.id !== account.id) {
    throw new UserInputError("Email is already taken");
  }
  return email;
}

// Two accounts claiming one address at the same moment both pass the check above; the unique
// index lets only one win, and the loser gets the same answer as a normal clash.
async function saveProfile(context: AppContext, userId: string, data: object) {
  try {
    return await context.prisma.user.update({ where: { id: userId }, data });
  } catch (error: any) {
    if (error?.code === "P2002") throw new UserInputError("Email is already taken");
    throw error;
  }
}

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
        // Allowlist of the User type's stored scalar fields; never select the password hash.
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          lastLoginAt: true,
          isActive: true,
          hasFaceRegistered: true,
          hasVoiceRegistered: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return users as UserResponse[];
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
      assertPasswordWithinByteLimit(password);

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

      const token = SecurityConfig.generateToken(user);

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

      // No real address is this long. Refusing it here keeps oversized text out of the attempt
      // table; it is not a guess at any account, so it is not counted.
      if (email.length > MAX_EMAIL_LENGTH) {
        throw new AuthenticationError("Invalid email or password");
      }

      // Every email, real or not, is limited the same way, so the lockout reveals nothing about
      // which accounts exist. The attempt is reserved before the password is compared.
      const attempt = reserveSignIn(email, context.req?.ip);
      if (!attempt.allowed) {
        countSecurityEvent("auth.sign_in.locked", { scope: attempt.scope });
        const minutes = Math.ceil(attempt.retryAfterMs / 60_000);
        throw new UserInputError(`Too many sign-in attempts. Try again in ${minutes} minutes.`);
      }

      const user = await context.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      const isValidPassword = await bcrypt.compare(
        password,
        user?.password || DUMMY_HASH
      );
      // A disabled account gets the same generic failure, after the password check so timing is unchanged.
      if (!user || !user.password || !isValidPassword || !user.isActive) {
        // Not awaited: an audit write only for real accounts would make them slower to refuse.
        void recordSignInFailure(context, user, {
          passwordWasRight: Boolean(user?.password) && isValidPassword,
          isActive: Boolean(user?.isActive),
          reachedLimit: attempt.reachedLimit,
        });
        throw new AuthenticationError("Invalid email or password");
      }

      markSignInSucceeded(email, context.req?.ip);

      const token = SecurityConfig.generateToken(user);

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
      args: { name?: string | null; email?: string | null; currentPassword?: string | null },
      context: AppContext
    ): Promise<UserResponse> => {
      const user = AuthorizationService.requireAuth(context);
      const account = await context.prisma.user.findUnique({ where: { id: user.userId } });
      if (!account) throw new AuthenticationError("User not found");

      const updateData: any = {};
      const changed: string[] = [];
      if (args.name !== undefined) {
        const name = (args.name ?? "").trim();
        if (name.length < 1 || name.length > 100) {
          throw new UserInputError("Name must be between 1 and 100 characters");
        }
        updateData.name = name;
        if (name !== account.name) changed.push("name");
      }

      const newEmail = args.email === undefined ? undefined : await validatedNewEmail(context, account, args);
      if (newEmail !== undefined && newEmail !== account.email.toLowerCase().trim()) {
        updateData.email = newEmail;
      }

      const updatedUser = await saveProfile(context, user.userId, updateData);

      if (changed.length > 0) {
        await recordAccountEvent(context, account, "PROFILE_UPDATED", { changed });
      }
      if (updateData.email) {
        await recordAccountEvent(context, account, "EMAIL_CHANGED", { changed: ["email"] });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    },

    changePassword: async (
      _: any,
      args: { currentPassword: string; newPassword: string },
      context: AppContext
    ): Promise<{ success: boolean; message: string; token: string }> => {
      const user = AuthorizationService.requireAuth(context);

      const { currentPassword, newPassword } = args;

      if (newPassword.length < 8) {
        throw new UserInputError("New password must be at least 8 characters long");
      }
      assertPasswordWithinByteLimit(newPassword);

      const dbUser = await context.prisma.user.findUnique({
        where: { id: user.userId},
      });

      if (!dbUser) {
        throw new AuthenticationError("User not found");
      }

      if (!dbUser.password) {
        throw new AuthenticationError("No password set for this account");
      }

      await verifyCurrentPassword(context, { ...dbUser, password: dbUser.password }, currentPassword, "change_password");

      // Prevent reusing the same password
      const isSamePassword = await bcrypt.compare(newPassword, dbUser.password);
      if (isSamePassword) {
        throw new UserInputError("New password must be different from current password");
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Conditional on the hash that was just verified, so two simultaneous changes cannot
      // both report success while only one password is stored.
      const { count } = await context.prisma.user.updateMany({
        where: { id: user.userId, password: dbUser.password },
        data: { password: hashedNewPassword },
      });
      if (count === 0) {
        throw new UserInputError("Your password was just changed from another session. Please try again.");
      }

      // Tokens are bound to the password, so every other session just ended. Hand the
      // caller a fresh token so this device stays signed in.
      const token = SecurityConfig.generateToken({ ...dbUser, password: hashedNewPassword });

      // Live subscriptions were authenticated with an old token; close them so they reconnect.
      closeUserSockets(user.userId);
      await recordAccountEvent(context, dbUser, "PASSWORD_CHANGED", { otherSessionsEnded: true });

      return {
        success: true,
        message: "Password updated successfully",
        token,
      };
    },

    // Ends every session except this one without asking for a password: this is how someone who
    // suspects a stolen session takes control back, so it must work even while the password
    // checks are locked. The caller gets a fresh token and stays signed in.
    signOutOtherSessions: async (
      _: any,
      __: any,
      context: AppContext
    ): Promise<{ success: boolean; message: string; token: string }> => {
      const user = AuthorizationService.requireAuth(context);

      // One atomic increment: every token issued under the old value stops working.
      const account = await context.prisma.user.update({
        where: { id: user.userId },
        data: { sessionVersion: { increment: 1 } },
      });

      // Live subscriptions were authenticated with an old token; close them so they reconnect.
      closeUserSockets(user.userId);
      await recordAccountEvent(context, account, "OTHER_SESSIONS_ENDED", {});

      return {
        success: true,
        message: "You were signed out everywhere else",
        token: SecurityConfig.generateToken(account),
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

      if (!user.isActive) {
        throw new AuthenticationError("Account disabled.");
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
      const token = SecurityConfig.generateToken(user);

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
