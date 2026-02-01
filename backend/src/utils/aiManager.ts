import prisma from "../lib/db";
import { GraphQLError } from "graphql";
import crypto from "crypto";

// Configuration
const DAILY_IMAGE_LIMIT = 10;
const DAILY_CHAT_LIMIT = 20;

export class AIManager {
  /**
   * STRATEGY 3: KEY ROTATION (For Gemini only now)
   * Note: Pollinations doesn't need API keys!
   */
  static getRandomKey(envVarName: 'GEMINI_KEYS'): string {
    const keysString = process.env[envVarName] || "";
    const keys = keysString.split(",").map(k => k.trim());
    
    if (keys.length === 0 || !keys[0]) {
      throw new Error(`API Keys for ${envVarName} are missing!`);
    }
    
    const randomIndex = Math.floor(Math.random() * keys.length);
    return keys[randomIndex];
  }

  /**
   * STRATEGY 1: QUOTA CHECK & RESET
   */
  static async checkQuota(userId: string, type: 'image' | 'chat') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new GraphQLError("User not found");

    // Check if 24 hours have passed since lastReset
    const now = new Date();
    const lastReset = new Date(user.lastQuotaReset);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      // RESET: If 24h passed, set usage to 0 and update lastReset to now
      await prisma.user.update({
        where: { id: userId },
        data: { imageUsage: 0, chatUsage: 0, lastQuotaReset: now }
      });
      return; // Quota is fresh
    }

    // Check if limit exceeded
    if (type === 'image' && user.imageUsage >= DAILY_IMAGE_LIMIT) {
      throw new GraphQLError(`Daily image limit reached (${DAILY_IMAGE_LIMIT}). Resets every 24h.`);
    }
    if (type === 'chat' && user.chatUsage >= DAILY_CHAT_LIMIT) {
      throw new GraphQLError(`Daily chat limit reached (${DAILY_CHAT_LIMIT}). Resets every 24h.`);
    }
  }

  static async incrementUsage(userId: string, type: 'image' | 'chat') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        [type === 'image' ? 'imageUsage' : 'chatUsage']: { increment: 1 }
      }
    });
  }

  /**
   * STRATEGY 2: PROMPT CACHING (FOR IMAGES)
   * This is even MORE valuable now since Pollinations is free!
   */
  static async getCachedImage(prompt: string): Promise<string | null> {
    const hash = crypto.createHash('md5').update(prompt.toLowerCase().trim()).digest('hex');
    const cached = await prisma.imageCache.findUnique({ where: { promptHash: hash } });
    return cached ? cached.imageUrl : null;
  }

  static async cacheImage(prompt: string, imageUrl: string) {
    const hash = crypto.createHash('md5').update(prompt.toLowerCase().trim()).digest('hex');
    await prisma.imageCache.upsert({
      where: { promptHash: hash },
      update: {},
      create: { promptHash: hash, imageUrl }
    });
  }
}