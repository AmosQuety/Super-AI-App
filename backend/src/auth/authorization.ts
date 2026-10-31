// src/auth/authorization.ts - UPDATED
import { AuthenticationError, ForbiddenError } from 'apollo-server-express';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}

// FIX: Update interface to match JWTPayload (userId instead of id)
export interface AuthContext {
  user: { userId: string; email: string; role?: string } | null;
}

export class AuthorizationService {
  static requireAuth(context: AuthContext) {
    if (!context.user) {
      throw new AuthenticationError('Authentication required. Please log in.');
    }
    return context.user;
  }

  static isAdmin(user: { role?: string }): boolean {
    return user.role === UserRole.ADMIN;
  }

  static requireRole(context: AuthContext, requiredRole: UserRole) {
    const user = this.requireAuth(context);
    
    const userRole: UserRole = (user as any).role as UserRole || UserRole.USER;
    
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.USER]: 1,
      [UserRole.MODERATOR]: 2,
      [UserRole.ADMIN]: 3,
    };

    // Roles are free text in the database, so a value that is not a real role must be
    // denied, not compared (this also rejects names such as "constructor").
    const isKnownRole = (Object.values(UserRole) as string[]).includes(userRole);
    if (!isKnownRole || roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenError(
        `Insufficient permissions. Required role: ${requiredRole}`
      );
    }
  }

  static requireOwnership(context: AuthContext, resourceUserId: string) {
    const user = this.requireAuth(context);
    
    // FIX: use userId instead of id
    if (user.userId !== resourceUserId) {
      if (!this.isAdmin(user)) {
        throw new ForbiddenError('Access denied. You can only access your own resources.');
      }
    }
  }

  static requireSelfOrAdmin(context: AuthContext, targetUserId: string) {
    const user = this.requireAuth(context);
    
    // FIX: use userId instead of id
    if (user.userId !== targetUserId) {
      if (!this.isAdmin(user)) {
        throw new ForbiddenError('Access denied. You can only access your own profile.');
      }
    }
  }
}