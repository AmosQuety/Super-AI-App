import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";

const WEB_USERS_QUERY = "{ users { id email name role isActive createdAt updatedAt } }";

const storedUser: Record<string, unknown> = {
  id: "user_1",
  email: "one@example.test",
  name: "One",
  password: "hash-that-must-never-leave-the-database",
  role: "USER",
  avatarUrl: null,
  lastLoginAt: null,
  isActive: true,
  hasFaceRegistered: false,
  hasVoiceRegistered: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

// Applies `select` like Prisma does, so a missing or over-broad select is visible to the test.
function findManyHonouringSelect(args?: { select?: Record<string, boolean> }) {
  if (!args?.select) return [storedUser];
  const picked: Record<string, unknown> = {};
  for (const field of Object.keys(args.select)) picked[field] = storedUser[field];
  return [picked];
}

async function runUsersQueryAs(user: { userId: string; email: string; role?: string } | null) {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const prisma = { user: { findMany: async (args?: any) => findManyHonouringSelect(args) } };
  return graphql({ schema, source: WEB_USERS_QUERY, contextValue: { prisma, user } });
}

async function rejectsAnonymousCaller() {
  const result = await runUsersQueryAs(null);
  assert.equal(result.errors?.[0]?.extensions?.code, "UNAUTHENTICATED");
  assert.equal(result.data, null);
}

async function rejectsOrdinaryUser() {
  const result = await runUsersQueryAs({ userId: "user_1", email: "one@example.test", role: "USER" });
  assert.equal(result.errors?.[0]?.extensions?.code, "FORBIDDEN");
}

async function listsUsersForAdmin() {
  const result = await runUsersQueryAs({ userId: "admin_1", email: "admin@example.test", role: "ADMIN" });
  assert.equal(result.errors, undefined);
  const users = (result.data as any).users;
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "one@example.test");
  assert.equal(users[0].role, "USER");
}

async function neverSelectsPasswordHash() {
  let receivedArgs: any;
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const prisma = {
    user: {
      findMany: async (args?: any) => {
        receivedArgs = args;
        return findManyHonouringSelect(args);
      },
    },
  };
  const admin = { userId: "admin_1", email: "admin@example.test", role: "ADMIN" };
  await graphql({ schema, source: WEB_USERS_QUERY, contextValue: { prisma, user: admin } });
  assert.ok(receivedArgs?.select, "users must use an explicit select allowlist");
  assert.notEqual(receivedArgs.select.password, true);
}

async function main() {
  await rejectsAnonymousCaller();
  await rejectsOrdinaryUser();
  await listsUsersForAdmin();
  await neverSelectsPasswordHash();
  console.log("usersQueryAuthorization tests passed");
}

// Importing the resolvers opens Redis and Prisma handles, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
