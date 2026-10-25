import { cacheDel, cacheDelPattern } from "../lib/redis";
import { logger } from "../utils/logger";

// The chat list and a chat's history are cached briefly (see chatQueries). Every write that
// changes what they return must drop the affected entries, or a new chat is missing from the
// list and a chat that was just used looks empty when it is opened again.

export const chatListCacheKey = (userId: string) => `user:${userId}:chats`;

export const chatHistoryCacheKey = (userId: string, chatId: string, limit: number, offset: number) =>
  `user:${userId}:chatHistory:${chatId}:limit:${limit}:offset:${offset}`;

// The Redis client queues commands without limit while Redis is down, so a stuck invalidation
// must not hold up the write that triggered it. Past this wait the write continues; an entry
// that survives is only stale until its short expiry.
export const INVALIDATION_TIMEOUT_MS = 500;

async function withinTimeout(invalidation: Promise<void>, what: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      logger.warn("[cache] invalidation timed out; continuing", { what });
      resolve();
    }, INVALIDATION_TIMEOUT_MS);
  });
  try {
    await Promise.race([invalidation, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export const invalidateChatList = (userId: string) =>
  withinTimeout(cacheDel(chatListCacheKey(userId)), "chat list");

// Every page of the chat: the key includes limit and offset, so match them all.
export const invalidateChatHistory = (userId: string, chatId: string) =>
  withinTimeout(cacheDelPattern(`user:${userId}:chatHistory:${chatId}:*`), "chat history");
