// src/auth/authorization.ts - UPDATED
import { AuthenticationError, ForbiddenError } from 'apollo-server-express';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}

// Create a minimal context interface for authorization
export interface AuthContext {
  user: { id: string; email: string; role?: string } | null;
}

export class AuthorizationService {
  static requireAuth(context: AuthContext) {
    if (!context.user) {
      throw new AuthenticationError('Authentication required. Please log in.');
    }
    return context.user;
  }

  static requireRole(context: AuthContext, requiredRole: UserRole) {
    const user = this.requireAuth(context);
    
    // In a real implementation, you'd check user.role from database
    // For now, we'll assume all users have USER role unless specified
    const userRole: UserRole = (user as any).role as UserRole || UserRole.USER;
    
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.USER]: 1,
      [UserRole.MODERATOR]: 2,
      [UserRole.ADMIN]: 3,
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenError(
        `Insufficient permissions. Required role: ${requiredRole}`
      );
    }
  }

  static requireOwnership(context: AuthContext, resourceUserId: string) {
    const user = this.requireAuth(context);
    
    // Allow access if user owns the resource or is admin
    if (user.id !== resourceUserId) {
      // Check if user is admin (you'd get this from database in real implementation)
      const userRole = (user as any).role || UserRole.USER;
      if (userRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied. You can only access your own resources.');
      }
    }
  }

  static requireSelfOrAdmin(context: AuthContext, targetUserId: string) {
    const user = this.requireAuth(context);
    
    if (user.id !== targetUserId) {
      const userRole = (user as any).role || UserRole.USER;
      if (userRole !== UserRole.ADMIN) {
        throw new ForbiddenError('Access denied. You can only access your own profile.');
      }
    }
}}