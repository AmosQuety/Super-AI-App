import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { SecurityConfig } from "../src/auth/security";
import { authenticateToken } from "../src/auth/sessionUser";
import { FaceRecognitionService } from "../src/services/faceRecognitionService";
import { VoiceCloningService } from "../src/services/voiceCloningService";
import { redisClient } from "../src/lib/redis";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

// An in-memory stand-in for the users table, shared by every call in one scenario.
function fakeDatabase(initialPassword = OLD_PASSWORD) {
  const users = new Map<string, any>();
  const add = (id: string, password: string) =>
    users.set(id, { id, email: `${id}@example.test`, name: id, role: "USER", isActive: true, hasVoiceRegistered: true, password: bcrypt.hashSync(password, 4) });
  add("u1", initialPassword);
  add("u2", initialPassword);
  // Like Prisma, reads return copies: a row fetched before an update keeps its old values.
  const copyOf = (row: any) => (row ? { ...row } : null);
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => copyOf(users.get(where.id) ?? [...users.values()].find((u) => u.email === where.email)),
      update: async ({ where, data }: any) => Object.assign(users.get(where.id), data),
    },
    securityAuditLog: { create: async () => undefined },
  };
  const lookupAccount = async (userId: string) => copyOf(users.get(userId));
  return { prisma, lookupAccount, users };
}

async function run(db: ReturnType<typeof fakeDatabase>, source: string, variables: Record<string, unknown> = {}, user: any = null) {
  return graphql({ schema, source, variableValues: variables, contextValue: { prisma: db.prisma, user } }) as Promise<any>;
}

const LOGIN = `mutation($e: String!, $p: String!) { login(email: $e, password: $p) { token } }`;
const CHANGE = `mutation($c: String!, $n: String!) { changePassword(currentPassword: $c, newPassword: $n) { success token } }`;

async function loginToken(db: ReturnType<typeof fakeDatabase>, userId: string, password = OLD_PASSWORD) {
  const result = await run(db, LOGIN, { e: `${userId}@example.test`, p: password });
  assert.equal(result.errors, undefined);
  return result.data.login.token as string;
}

async function sessionOf(db: ReturnType<typeof fakeDatabase>, token: string | undefined) {
  return authenticateToken(token, db.lookupAccount);
}

function fingerprintIsShortStableAndDoesNotExposeTheHash() {
  const hash = bcrypt.hashSync(OLD_PASSWORD, 4);
  const fingerprint = SecurityConfig.passwordFingerprint(hash);
  assert.match(fingerprint, /^[0-9a-f]{16}$/);
  assert.equal(SecurityConfig.passwordFingerprint(hash), fingerprint);
  assert.notEqual(SecurityConfig.passwordFingerprint(bcrypt.hashSync(NEW_PASSWORD, 4)), fingerprint);
  assert.equal(hash.includes(fingerprint), false);
}

// An account with no stored password (null) must still have a stable, comparable fingerprint.
function anAccountWithoutAPasswordHasAStableFingerprint() {
  assert.equal(SecurityConfig.passwordFingerprint(null), SecurityConfig.passwordFingerprint(undefined));
  assert.notEqual(SecurityConfig.passwordFingerprint(null), SecurityConfig.passwordFingerprint(bcrypt.hashSync(OLD_PASSWORD, 4)));
}

function generateTokenCarriesTheFingerprintOfTheStoredHash() {
  const hash = bcrypt.hashSync(OLD_PASSWORD, 4);
  const token = SecurityConfig.generateToken({ id: "u1", email: "u1@example.test", role: "USER", password: hash });
  assert.equal(SecurityConfig.verifyToken(token).pwf, SecurityConfig.passwordFingerprint(hash));
  assert.equal(JSON.stringify(SecurityConfig.verifyToken(token)).includes(hash), false);
}

async function everyLoginPathIssuesATokenBoundToThePassword() {
  const db = fakeDatabase();
  const expected = SecurityConfig.passwordFingerprint(db.users.get("u1").password);

  const loggedIn = await loginToken(db, "u1");
  assert.equal(SecurityConfig.verifyToken(loggedIn).pwf, expected);

  const registerPrisma = { user: { findUnique: async () => null, create: async () => db.users.get("u1") } };
  const registered: any = await graphql({
    schema,
    source: `mutation { register(email: "new@example.test", password: "a-long-enough-password") { token } }`,
    contextValue: { prisma: registerPrisma, user: null },
  });
  assert.equal(SecurityConfig.verifyToken(registered.data.register.token).pwf, expected);

  if (redisClient) {
    (redisClient as any).get = async (key: string) => (key.startsWith("voice_challenge:") ? "1234" : null);
    (redisClient as any).del = async () => 1;
  }
  VoiceCloningService.prototype.verifyVoice = async () => ({ success: true, similarity: 0.99 } as any);
  const voice = await (resolvers as any).Mutation.loginWithVoice(
    undefined,
    { email: "u1@example.test", challengeCode: "1234", audio: Promise.resolve({}) },
    { prisma: db.prisma, user: null }
  );
  assert.equal(SecurityConfig.verifyToken(voice.token).pwf, expected);

  FaceRecognitionService.prototype.checkHealth = async () => ({ isOnline: true } as any);
  FaceRecognitionService.prototype.verifyFace = async () => ({ success: true, matchedUser: "u1@example.test", emotion: "neutral" } as any);
  const face = await (resolvers as any).Mutation.loginWithFace(undefined, { image: Promise.resolve({}) }, { prisma: { user: { ...db.prisma.user, update: async () => undefined } }, user: null });
  assert.equal(SecurityConfig.verifyToken(face.token).pwf, expected);
}

async function aTokenWithoutTheClaimIsNoSession() {
  const db = fakeDatabase();
  const legacy = SecurityConfig.createToken({ userId: "u1", email: "u1@example.test", role: "USER" });
  assert.equal(await sessionOf(db, legacy), null);
}

async function aTokenForADifferentPasswordIsNoSession() {
  const db = fakeDatabase();
  const forged = SecurityConfig.createToken({ userId: "u1", email: "u1@example.test", role: "USER", pwf: SecurityConfig.passwordFingerprint("some-other-hash") });
  assert.equal(await sessionOf(db, forged), null);
}

// The scenario the feature exists for: a stolen session must die when the password changes.
async function changingThePasswordEndsOtherSessionsButKeepsTheCurrentOne() {
  const db = fakeDatabase();
  const thisDevice = await loginToken(db, "u1");
  const stolen = await loginToken(db, "u1");
  const otherUser = await loginToken(db, "u2");
  assert.ok(await sessionOf(db, stolen));

  const session = await sessionOf(db, thisDevice);
  const changed = await run(db, CHANGE, { c: OLD_PASSWORD, n: NEW_PASSWORD }, session);
  assert.equal(changed.errors, undefined);
  const freshToken = changed.data.changePassword.token as string;

  assert.equal(await sessionOf(db, thisDevice), null, "the pre-change token is rejected");
  assert.equal(await sessionOf(db, stolen), null, "another device's token is rejected");
  assert.equal((await sessionOf(db, freshToken))?.userId, "u1", "the returned token works");
  assert.equal((await sessionOf(db, otherUser))?.userId, "u2", "another user is unaffected");

  assert.ok(await loginToken(db, "u1", NEW_PASSWORD), "the new password logs in");
}

async function aFailedChangeLeavesEverySessionValid() {
  const db = fakeDatabase();
  const token = await loginToken(db, "u1");
  const failed = await run(db, CHANGE, { c: "wrong-password-0", n: NEW_PASSWORD }, await sessionOf(db, token));
  assert.equal(failed.errors[0].extensions.code, "BAD_USER_INPUT");
  assert.ok(await sessionOf(db, token));
}

async function main() {
  fingerprintIsShortStableAndDoesNotExposeTheHash();
  anAccountWithoutAPasswordHasAStableFingerprint();
  generateTokenCarriesTheFingerprintOfTheStoredHash();
  await everyLoginPathIssuesATokenBoundToThePassword();
  await aTokenWithoutTheClaimIsNoSession();
  await aTokenForADifferentPasswordIsNoSession();
  await changingThePasswordEndsOtherSessionsButKeepsTheCurrentOne();
  await aFailedChangeLeavesEverySessionValid();
  console.log("passwordSessions tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
