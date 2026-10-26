import "./support/testEnvironment";
import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import bcrypt from "bcryptjs";
import { SecurityConfig } from "../src/auth/security";
import { resetAllFailedAttempts } from "../src/auth/passwordAttempts";
import { authenticateToken, StoredAccount } from "../src/auth/sessionUser";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const HASH = "stored-password-hash-1";

function tokenWith(sessionVersion: number | undefined) {
  return SecurityConfig.createToken({
    userId: "me_1",
    email: "me@example.test",
    role: "USER",
    pwf: SecurityConfig.passwordFingerprint(HASH),
    ...(sessionVersion === undefined ? {} : { sv: sessionVersion }),
  });
}

const accountAt = (sessionVersion: number | undefined): StoredAccount => ({
  role: "USER",
  isActive: true,
  password: HASH,
  ...(sessionVersion === undefined ? {} : { sessionVersion }),
});

async function acceptedBy(token: string, account: StoredAccount) {
  return (await authenticateToken(token, async () => account)) !== null;
}

async function aTokenMustMatchTheAccountsSessionVersion() {
  assert.equal(await acceptedBy(tokenWith(2), accountAt(2)), true);
  assert.equal(
    await acceptedBy(tokenWith(1), accountAt(2)),
    false,
    "an older session is refused",
  );
  assert.equal(
    await acceptedBy(tokenWith(3), accountAt(2)),
    false,
    "a version the account never reached is refused",
  );
}

async function tokensIssuedBeforeTheClaimExistedStayValidAtVersionZero() {
  assert.equal(await acceptedBy(tokenWith(undefined), accountAt(0)), true);
  assert.equal(
    await acceptedBy(tokenWith(undefined), accountAt(undefined)),
    true,
  );
  assert.equal(await acceptedBy(tokenWith(undefined), accountAt(1)), false);
}

function newTokensCarryTheSessionVersion() {
  const claim = (user: object) =>
    SecurityConfig.verifyToken(SecurityConfig.generateToken(user)).sv;
  assert.equal(
    claim({
      id: "me_1",
      email: "e",
      role: "USER",
      password: HASH,
      sessionVersion: 4,
    }),
    4,
  );
  assert.equal(
    claim({ id: "me_1", email: "e", role: "USER", password: HASH }),
    0,
  );
}

function makeContext(signedIn = true) {
  const audits: any[] = [];
  const updates: any[] = [];
  const stored: any = {
    id: "me_1",
    email: "me@example.test",
    name: "Me",
    password: HASH,
    role: "USER",
    isActive: true,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    user: {
      update: async ({ where, data }: any) => {
        updates.push({ where, data });
        if (data.sessionVersion?.increment)
          stored.sessionVersion += data.sessionVersion.increment;
        return { ...stored };
      },
    },
    securityAuditLog: {
      create: async ({ data }: any) => (audits.push(data), data),
    },
  };
  const user = signedIn
    ? { userId: "me_1", email: "me@example.test", role: "USER" }
    : null;
  return {
    context: { user, prisma, req: { ip: "10.0.0.1", headers: {} } } as any,
    audits,
    updates,
    stored,
  };
}

const signOutOthers = `mutation { signOutOtherSessions { success message token } }`;

async function signingOutOthersNeedsASession() {
  const { context, updates } = makeContext(false);
  const result: any = await graphql({
    schema,
    source: signOutOthers,
    contextValue: context,
  });
  assert.equal(result.errors?.[0]?.extensions?.code, "UNAUTHENTICATED");
  assert.deepEqual(updates, []);
}

async function theCallerKeepsASessionAndEveryOtherEnds() {
  const { context, audits, updates, stored } = makeContext();
  const callerToken = tokenWith(1);
  assert.equal(await acceptedBy(callerToken, { ...accountAt(1) }), true);

  const result: any = await graphql({
    schema,
    source: signOutOthers,
    contextValue: context,
  });
  assert.equal(result.errors, undefined);
  assert.equal(result.data.signOutOtherSessions.success, true);

  // The write is a single atomic increment of the caller's own row.
  assert.deepEqual(updates, [
    { where: { id: "me_1" }, data: { sessionVersion: { increment: 1 } } },
  ]);

  const fresh = result.data.signOutOtherSessions.token;
  const nowStored = accountAt(stored.sessionVersion);
  assert.equal(
    await acceptedBy(fresh, nowStored),
    true,
    "the returned token works",
  );
  assert.equal(
    await acceptedBy(callerToken, nowStored),
    false,
    "every earlier token is refused",
  );
  assert.equal(SecurityConfig.verifyToken(fresh).sv, 2);

  assert.deepEqual(
    audits.map((a) => a.event),
    ["OTHER_SESSIONS_ENDED"],
  );
  assert.equal(audits[0].userId, "me_1");
  assert.ok(!JSON.stringify(audits).includes(fresh));
}

async function changingThePasswordKeepsTheSessionVersion() {
  resetAllFailedAttempts();
  const current = "correct-horse-battery";
  const stored: any = {
    id: "me_1",
    email: "me@example.test",
    role: "USER",
    isActive: true,
    sessionVersion: 2,
    password: bcrypt.hashSync(current, 4),
  };
  const prisma = {
    user: {
      findUnique: async () => ({ ...stored }),
      updateMany: async ({ data }: any) => (
        Object.assign(stored, data),
        { count: 1 }
      ),
    },
    securityAuditLog: { create: async () => ({}) },
  };
  const context: any = {
    user: { userId: "me_1", email: stored.email, role: "USER" },
    prisma,
    req: { headers: {} },
  };
  const source = `mutation { changePassword(currentPassword: "${current}", newPassword: "a-different-long-password") { token } }`;
  const result: any = await graphql({ schema, source, contextValue: context });
  assert.equal(result.errors, undefined);
  const token = result.data.changePassword.token;
  assert.equal(SecurityConfig.verifyToken(token).sv, 2);
  assert.equal(
    await acceptedBy(token, {
      role: "USER",
      isActive: true,
      password: stored.password,
      sessionVersion: 2,
    }),
    true,
  );
}

async function main() {
  await changingThePasswordKeepsTheSessionVersion();
  await aTokenMustMatchTheAccountsSessionVersion();
  await tokensIssuedBeforeTheClaimExistedStayValidAtVersionZero();
  newTokensCarryTheSessionVersion();
  await signingOutOthersNeedsASession();
  await theCallerKeepsASessionAndEveryOtherEnds();
  console.log("sessionVersion tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
