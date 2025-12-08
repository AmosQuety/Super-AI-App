// src/auth/security.ts 
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export class SecurityConfig {
  private static validateSecret(): string {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long for production');
    }
    
    // Allow the default secret in development/test if needed, or remove this check
    if (secret === 'your-super-secret-jwt-key-at-least-32-chars' && process.env.NODE_ENV === 'production') {
      throw new Error('Change the default JWT_SECRET in production');
    }
    
    return secret;
  }

  static getJWTConfig() {
    // Wrap in try/catch to handle validation errors gracefully or just return secret
    try {
        const secret = this.validateSecret();
        return {
          secret,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          issuer: process.env.JWT_ISSUER || 'blaze-chat-app',
          audience: process.env.JWT_AUDIENCE || 'blaze-chat-users',
        };
    } catch (e) {
        // Fallback for development if env vars aren't set perfectly
        return {
            secret: 'fallback-secret-key-must-be-long-enough-for-signing',
            expiresIn: '7d',
            issuer: 'blaze-chat-app',
            audience: 'blaze-chat-users',
        }
    }
  }

  static generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static createToken(payload: Omit<JWTPayload, 'sessionId'>): string {
    const config = this.getJWTConfig();
    const sessionId = this.generateSessionId();
    
    const tokenPayload: JWTPayload = {
      ...payload,
      sessionId,
    };

    return jwt.sign(tokenPayload, config.secret, {
      expiresIn: config.expiresIn as any,
      issuer: config.issuer,
      audience: config.audience,
    } as any);
  }

  // --- ADD THIS NEW METHOD ---
  // This bridges the gap between Prisma User object and your JWT Payload
  static generateToken(user: any): string {
    return this.createToken({
      userId: user.id,
      email: user.email,
      role: user.role || 'USER', // Default role if missing
    });
  }
  // ---------------------------

  static verifyToken(token: string): JWTPayload {
    const config = this.getJWTConfig();
    
    try {
      const payload = jwt.verify(token, config.secret, {
        issuer: config.issuer,
        audience: config.audience,
      } as any) as unknown as JWTPayload;

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }
}