import "./support/testEnvironment";
import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { redisClient } from "../src/lib/redis";

// The chat list and a chat's history are cached for 60 and 30 seconds. A write must drop the
// affected entries, or a new chat is missing from the list and a chat that was just used shows
// as empty when it is opened again.

const schema = makeExecutableSchema({ typeDefs, resolvers });
const caller = { userId: "me_1", email: "me@example.test", role: "USER" };

const store = new Map<string, string>();

function useInMemoryRedis() {
  const globToRegExp = (glob: string) => new RegExp("^" + glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  (redisClient as any).get = async (key: string) => store.get(key) ?? null;
  (redisClient as any).set = async (key: string, value: string) => void store.set(key, value);
  (redisClient as any).del = async (...keys: string[]) => keys.filter((key) => store.delete(key)).length;
  (redisClient as any).scan = async (_cursor: string, _match: string, pattern: string) => {
    const matcher = globToRegExp(pattern);
    return ["0", [...store.keys()].filter((key) => matcher.test(key))];
  };
}

function makeContext() {
  const calls = { getUserChats: 0, getChatHistory: 0 };
  const context: any = {
    user: caller,
    prisma: {
      user: { findUnique: async () => ({ id: "me_1" }) },
      chat: {
        findUnique: async () => ({ id: "chat_1", userId: "me_1" }),
        create: async () => ({ id: "chat_new", userId: "me_1", messages: [] }),
        update: async () => ({ id: "chat_1" }),
        delete: async () => ({}),
      },
      message: {
        create: async () => ({ id: "m1", role: "user", content: "x", chatId: "chat_1", createdAt: new Date() }),
        deleteMany: async () => ({}),
        findUnique: async () => ({ id: "m1", chatId: "chat_1", chat: { id: "chat_1", userId: "me_1" } }),
        delete: async () => ({}),
      },
    },
    chatService: {
      getUserChats: async () => (calls.getUserChats++, [{ id: "chat_1", userId: "me_1" }]),
      getChatHistory: async () => (calls.getChatHistory++, { messages: [], total: 0, hasMore: false }),
    },
  };
  return { context, calls };
}

async function run(context: any, source: string) {
  const result: any = await graphql({ schema, source, contextValue: context });
  assert.equal(result.errors, undefined, JSON.stringify(result.errors?.[0]?.message));
}

const LIST = `{ chats(userId: "me_1") { id } }`;
const HISTORY = `{ chatHistory(chatId: "chat_1", limit: 50, offset: 0) { hasMore } }`;
const HISTORY_PAGE_2 = `{ chatHistory(chatId: "chat_1", limit: 50, offset: 50) { hasMore } }`;

async function theListIsServedFromTheCacheUntilAChatIsCreatedRenamedOrDeleted() {
  for (const write of [
    `mutation { createChat(userId: "me_1", title: "t", messages: []) { id } }`,
    `mutation { updateChat(chatId: "chat_1", title: "t") { id } }`,
    `mutation { deleteChat(chatId: "chat_1") }`,
  ]) {
    store.clear();
    const { context, calls } = makeContext();
    await run(context, LIST);
    await run(context, LIST);
    assert.equal(calls.getUserChats, 1, "the second read comes from the cache");

    await run(context, write);
    await run(context, LIST);
    assert.equal(calls.getUserChats, 2, `the cache was dropped by: ${write}`);
  }
}

async function everyCachedPageOfAChatIsDroppedWhenAMessageIsAdded() {
  store.clear();
  const { context, calls } = makeContext();
  await run(context, HISTORY);
  await run(context, HISTORY_PAGE_2);
  await run(context, HISTORY);
  assert.equal(calls.getChatHistory, 2, "page 1 is cached, page 2 was a separate read");

  await run(context, `mutation { addMessage(chatId: "chat_1", role: "user", content: "x") { id } }`);
  await run(context, HISTORY);
  await run(context, HISTORY_PAGE_2);
  assert.equal(calls.getChatHistory, 4, "both pages are read again");
}

async function deletingAMessageDropsTheCachedHistory() {
  store.clear();
  const { context, calls } = makeContext();
  await run(context, HISTORY);
  await run(context, `mutation { deleteMessage(messageId: "m1") }`);
  await run(context, HISTORY);
  assert.equal(calls.getChatHistory, 2);
}

async function deletingAChatDropsItsHistoryToo() {
  store.clear();
  const { context, calls } = makeContext();
  await run(context, HISTORY);
  await run(context, `mutation { deleteChat(chatId: "chat_1") }`);
  await run(context, HISTORY);
  assert.equal(calls.getChatHistory, 2);
}

async function otherChatsAndOtherUsersKeepTheirCache() {
  store.clear();
  store.set("user:me_1:chatHistory:chat_2:limit:50:offset:0", "[]");
  store.set("user:other_9:chatHistory:chat_1:limit:50:offset:0", "[]");
  store.set("user:other_9:chats", "[]");
  const { context } = makeContext();
  await run(context, `mutation { addMessage(chatId: "chat_1", role: "user", content: "x") { id } }`);
  assert.equal(store.has("user:me_1:chatHistory:chat_2:limit:50:offset:0"), true);
  assert.equal(store.has("user:other_9:chatHistory:chat_1:limit:50:offset:0"), true);
  assert.equal(store.has("user:other_9:chats"), true);
}

// With Redis unreachable the client waits indefinitely; the write must still complete.
async function aStuckRedisDoesNotHoldUpTheWrite() {
  (redisClient as any).del = () => new Promise(() => undefined);
  (redisClient as any).scan = () => new Promise(() => undefined);
  const { context } = makeContext();
  const started = Date.now();
  await run(context, `mutation { addMessage(chatId: "chat_1", role: "user", content: "x") { id } }`);
  await run(context, `mutation { deleteChat(chatId: "chat_1") }`);
  assert.ok(Date.now() - started < 4000, "both writes finished within the bounded wait");
  useInMemoryRedis();
}

async function main() {
  useInMemoryRedis();
  await aStuckRedisDoesNotHoldUpTheWrite();
  await theListIsServedFromTheCacheUntilAChatIsCreatedRenamedOrDeleted();
  await everyCachedPageOfAChatIsDroppedWhenAMessageIsAdded();
  await deletingAMessageDropsTheCachedHistory();
  await deletingAChatDropsItsHistoryToo();
  await otherChatsAndOtherUsersKeepTheirCache();
  console.log("chatCacheInvalidation tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
