// src/auth/security.ts 
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRole } from './authorization';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  // Fingerprint of the password hash the token was issued against (see passwordFingerprint).
  pwf?: string;
  // Session version the token was issued under; "sign out other sessions" raises the stored one.
  // A token without it predates the claim and counts as version 0.
  sv?: number;
  iat?: number;
  exp?: number;
}

export class SecurityConfig {
  private static validateSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    // The documented example value is public, so it must never sign real tokens.
    if (secret === 'your-super-secret-jwt-key-at-least-32-chars') {
      throw new Error('JWT_SECRET is still the default example value; set a unique secret');
    }

    return secret;
  }

  // There is deliberately no fallback secret: a missing or weak secret must stop
  // the server rather than let anyone who has read the source forge tokens.
  static getJWTConfig() {
    return {
      secret: this.validateSecret(),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'blaze-chat-app',
      audience: process.env.JWT_AUDIENCE || 'blaze-chat-users',
    };
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

  // Roles are free text in the database. Only known roles go into a token;
  // anything else gets the least privilege instead of being trusted.
  static roleForToken(storedRole: unknown): string {
    const knownRoles = Object.values(UserRole) as string[];
    return typeof storedRole === 'string' && knownRoles.includes(storedRole)
      ? storedRole
      : UserRole.USER;
  }

  // A short, keyed digest of the stored password hash. Tokens carry it so that changing
  // the password invalidates every token issued before the change, without a session
  // table. It is keyed with the signing secret and truncated, so a token never exposes
  // anything that helps guess the bcrypt hash. An account with no password hashes "".
  static passwordFingerprint(passwordHash: string | null | undefined): string {
    return crypto
      .createHmac('sha256', this.getJWTConfig().secret)
      .update(passwordHash ?? '')
      .digest('hex')
      .slice(0, 16);
  }

  // This bridges the gap between Prisma User object and your JWT Payload.
  // `user` must be the full stored row: its password hash is what the token is bound to.
  static generateToken(user: any): string {
    return this.createToken({
      userId: user.id,
      email: user.email,
      role: this.roleForToken(user.role),
      pwf: this.passwordFingerprint(user.password),
      sv: user.sessionVersion ?? 0,
    });
  }

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