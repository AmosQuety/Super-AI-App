// src/auth/UserRateLimit.ts
import { GraphQLError } from "graphql";

const limits = new Map<string, number[]>();

// Rules:
const LIMIT_WINDOW = 60 * 1000; // 1 Minute
const MAX_CHAT_REQUESTS = 10;   // 10 Chats per minute per user
const MAX_IMAGE_REQUESTS = 3;   // 3 Images per minute per user

export const checkUserRateLimit = (userId: string, type: 'chat' | 'image') => {
  const now = Date.now();
  const key = `${userId}_${type}`;
  const maxRequests = type === 'chat' ? MAX_CHAT_REQUESTS : MAX_IMAGE_REQUESTS;

  // Get existing timestamps for this user
  const timestamps = limits.get(key) || [];

  // Filter out timestamps older than the window (1 minute)
  const recentRequests = timestamps.filter(time => now - time < LIMIT_WINDOW);

  if (recentRequests.length >= maxRequests) {
    throw new GraphQLError(
      `Rate limit exceeded. You can only send ${maxRequests} ${type} requests per minute.`,
      { extensions: { code: 'TOO_MANY_REQUESTS' } }
    );
  }

  // Add current request
  recentRequests.push(now);
  limits.set(key, recentRequests);
};