import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { AuthorizationService, UserRole } from "../src/auth/authorization";
import { SecurityConfig } from "../src/auth/security";
import { createContext } from "../src/resolvers/types/context";
import { redisClient } from "../src/lib/redis";

type Caller = { userId: string; email: string; role?: string } | null;

const owner: Caller = { userId: "owner_1", email: "owner@example.test", role: "USER" };
const otherUser: Caller = { userId: "other_2", email: "other@example.test", role: "USER" };
const admin: Caller = { userId: "admin_1", email: "admin@example.test", role: "ADMIN" };

const ownedChat = { id: "chat_1", userId: "owner_1" };

function contextFor(user: Caller) {
  return {
    user,
    prisma: {
      chat: { findUnique: async ({ where }: any) => (where.id === ownedChat.id ? ownedChat : null) },
    },
    chatService: {
      getUserChats: async (userId: string) => [{ id: "chat_of_" + userId, userId }],
      getChatHistory: async () => ({ messages: [], total: 0, hasMore: false }),
    },
  } as any;
}

async function runQuery(source: string, user: Caller) {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  return graphql({ schema, source, contextValue: contextFor(user) });
}

// Replaces the Redis calls with a Map so the tests neither touch the dev Redis nor depend on its state.
const cacheStore = new Map<string, string>();

function useInMemoryCache() {
  if (!redisClient) return;
  (redisClient as any).get = async (key: string) => cacheStore.get(key) ?? null;
  (redisClient as any).set = async (key: string, value: string) => {
    cacheStore.set(key, value);
  };
}

function errorCode(result: any) {
  return result.errors?.[0]?.extensions?.code;
}

async function chatsRejectsAnotherUsersList() {
  const result = await runQuery('{ chats(userId: "owner_1") { id } }', otherUser);
  assert.equal(errorCode(result), "FORBIDDEN");
}

async function chatsAllowsOwnListAndAdmin() {
  const own = await runQuery('{ chats(userId: "owner_1") { id } }', owner);
  assert.equal(own.errors, undefined);
  const byAdmin = await runQuery('{ chats(userId: "owner_1") { id } }', admin);
  assert.equal(byAdmin.errors, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(byAdmin.data)), { chats: [{ id: "chat_of_owner_1" }] });
}

// A warm cache must never be served to someone who fails the authorization check.
async function authorizationRunsBeforeTheCache() {
  const warmed = '[{"id":"cached_chat","userId":"owner_1"}]';
  cacheStore.set("user:owner_1:chats", warmed);
  const result = await runQuery('{ chats(userId: "owner_1") { id } }', otherUser);
  assert.equal(errorCode(result), "FORBIDDEN");
  assert.equal(result.data, null);
}

async function chatHistoryHidesOtherUsersChat() {
  const result = await runQuery('{ chatHistory(chatId: "chat_1") { __typename } }', otherUser);
  assert.equal(result.errors?.[0]?.message, "Chat not found");
}

async function chatHistoryTreatsMissingChatTheSame() {
  const result = await runQuery('{ chatHistory(chatId: "nope") { __typename } }', owner);
  assert.equal(result.errors?.[0]?.message, "Chat not found");
}

async function chatHistoryAllowsOwnerAndAdmin() {
  const byOwner = await runQuery('{ chatHistory(chatId: "chat_1") { __typename } }', owner);
  assert.equal(byOwner.errors, undefined);
  const byAdmin = await runQuery('{ chatHistory(chatId: "chat_1") { __typename } }', admin);
  assert.equal(byAdmin.errors, undefined);
}

async function subscribe(field: string, user: Caller) {
  const subscription = (resolvers as any).Subscription[field];
  return subscription.subscribe(undefined, { chatId: "chat_1" }, contextFor(user), {});
}

async function subscriptionsRequireOwnershipOfTheChat() {
  for (const field of ["messageAdded", "messageChunkAdded"]) {
    await assert.rejects(() => subscribe(field, null), /Authentication required/);
    await assert.rejects(() => subscribe(field, otherUser), /Chat not found/);

    const iterator = await subscribe(field, owner);
    assert.equal(typeof iterator.next, "function");
    await iterator.return?.();
  }
}

function requireRoleAs(role: string, required: UserRole) {
  AuthorizationService.requireRole({ user: { userId: "u", email: "u@example.test", role } }, required);
}

function requireRoleFailsClosed() {
  assert.throws(() => requireRoleAs("admin", UserRole.ADMIN), /Insufficient permissions/);
  assert.throws(() => requireRoleAs("SUPERUSER", UserRole.ADMIN), /Insufficient permissions/);
  for (const inheritedName of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.throws(() => requireRoleAs(inheritedName, UserRole.ADMIN), /Insufficient permissions/);
  }
  assert.throws(() => requireRoleAs("MODERATOR", UserRole.ADMIN), /Insufficient permissions/);
  assert.doesNotThrow(() => requireRoleAs("ADMIN", UserRole.ADMIN));
  assert.doesNotThrow(() => requireRoleAs("MODERATOR", UserRole.USER));
}

async function webSocketContextReadsTokenFromConnectionParams() {
  const token = SecurityConfig.createToken({ userId: "owner_1", email: "owner@example.test", role: "USER" } as any);
  const withToken = await createContext({ connection: { connectionParams: { authToken: token } } });
  assert.equal(withToken.user?.userId, "owner_1");

  const withoutToken = await createContext({ connection: { connectionParams: {} } });
  assert.equal(withoutToken.user, null);
}

async function main() {
  useInMemoryCache();
  await chatsRejectsAnotherUsersList();
  await chatsAllowsOwnListAndAdmin();
  await authorizationRunsBeforeTheCache();
  await chatHistoryHidesOtherUsersChat();
  await chatHistoryTreatsMissingChatTheSame();
  await chatHistoryAllowsOwnerAndAdmin();
  await subscriptionsRequireOwnershipOfTheChat();
  requireRoleFailsClosed();
  await webSocketContextReadsTokenFromConnectionParams();
  console.log("chatAuthorization tests passed");
}

// Importing the resolvers opens Redis and Prisma handles, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
