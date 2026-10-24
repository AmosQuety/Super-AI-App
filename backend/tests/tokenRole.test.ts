import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { SecurityConfig } from "../src/auth/security";
import { VoiceCloningService } from "../src/services/voiceCloningService";
import { redisClient } from "../src/lib/redis";

function roleInToken(token: string) {
  return SecurityConfig.verifyToken(token).role;
}

function generateTokenKeepsKnownRoles() {
  for (const role of ["USER", "MODERATOR", "ADMIN"]) {
    const token = SecurityConfig.generateToken({ id: "u1", email: "u1@example.test", role });
    assert.equal(roleInToken(token), role);
  }
}

function generateTokenFallsBackToLeastPrivilege() {
  for (const storedRole of ["admin", "SUPERUSER", "constructor", "__proto__", "", null, undefined]) {
    const token = SecurityConfig.generateToken({ id: "u1", email: "u1@example.test", role: storedRole });
    assert.equal(roleInToken(token), "USER", `stored role ${String(storedRole)}`);
  }
}

async function storedUser(role: string, isActive = true) {
  return {
    id: "u1",
    email: "u1@example.test",
    name: "U One",
    password: await bcrypt.hash("correct-password", 4),
    role,
    isActive,
    hasVoiceRegistered: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function loginWithStoredRole(role: string) {
  const user = await storedUser(role);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const source =
    'mutation { login(email: "u1@example.test", password: "correct-password") { token user { id } } }';
  const contextValue = { prisma: { user: { findUnique: async () => user } }, user: null };
  const result: any = await graphql({ schema, source, contextValue });
  assert.equal(result.errors, undefined);
  return roleInToken(result.data.login.token);
}

async function passwordLoginCarriesTheStoredRole() {
  assert.equal(await loginWithStoredRole("ADMIN"), "ADMIN");
  assert.equal(await loginWithStoredRole("USER"), "USER");
}

async function passwordLoginDoesNotTrustUnknownRoles() {
  assert.equal(await loginWithStoredRole("SUPERUSER"), "USER");
}

async function disabledAccountCannotLoginWithPassword() {
  const user = await storedUser("ADMIN", false);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const source =
    'mutation { login(email: "u1@example.test", password: "correct-password") { token } }';
  const contextValue = { prisma: { user: { findUnique: async () => user } }, user: null };
  const result: any = await graphql({ schema, source, contextValue });
  assert.equal(result.errors?.[0]?.message, "Invalid email or password");
  assert.equal(result.data, null);
}

async function registerWithStoredRole(role: string) {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const created = await storedUser(role);
  const prisma = { user: { findUnique: async () => null, create: async () => created } };
  const source =
    'mutation { register(email: "u1@example.test", password: "a-long-enough-password", name: "U") { token } }';
  const result: any = await graphql({ schema, source, contextValue: { prisma, user: null } });
  assert.equal(result.errors, undefined);
  return roleInToken(result.data.register.token);
}

async function registerCarriesTheStoredRoleOnlyIfKnown() {
  assert.equal(await registerWithStoredRole("ADMIN"), "ADMIN");
  assert.equal(await registerWithStoredRole("SUPERUSER"), "USER");
}

// loginWithVoice reads Redis for the challenge; answer from memory so the test needs no Redis.
function stubVoiceChallengeStore(challengeCode: string) {
  if (!redisClient) return;
  (redisClient as any).get = async (key: string) => (key.startsWith("voice_challenge:") ? challengeCode : null);
  (redisClient as any).del = async () => 1;
}

async function voiceLoginAs(user: any) {
  stubVoiceChallengeStore("1234");
  VoiceCloningService.prototype.verifyVoice = async () => ({ success: true, similarity: 0.99 } as any);
  const prisma = {
    user: { findUnique: async () => user },
    securityAuditLog: { create: async () => undefined },
  };
  const args = { email: user.email, challengeCode: "1234", audio: Promise.resolve({}) };
  return (resolvers as any).Mutation.loginWithVoice(undefined, args, { prisma, user: null });
}

async function voiceLoginCarriesTheStoredRoleOnlyIfKnown() {
  const admin = await voiceLoginAs(await storedUser("ADMIN"));
  assert.equal(roleInToken(admin.token), "ADMIN");
  const unknown = await voiceLoginAs(await storedUser("SUPERUSER"));
  assert.equal(roleInToken(unknown.token), "USER");
}

async function disabledAccountCannotLoginWithVoice() {
  await assert.rejects(async () => voiceLoginAs(await storedUser("ADMIN", false)), /Account disabled/);
}

async function main() {
  generateTokenKeepsKnownRoles();
  generateTokenFallsBackToLeastPrivilege();
  await passwordLoginCarriesTheStoredRole();
  await passwordLoginDoesNotTrustUnknownRoles();
  await disabledAccountCannotLoginWithPassword();
  await registerCarriesTheStoredRoleOnlyIfKnown();
  await voiceLoginCarriesTheStoredRoleOnlyIfKnown();
  await disabledAccountCannotLoginWithVoice();
  console.log("tokenRole tests passed");
}

// Importing the resolvers opens Redis and Prisma handles, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
