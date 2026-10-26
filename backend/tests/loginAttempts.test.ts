import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import {
  MAX_FAILED_ATTEMPTS,
  resetAllFailedAttempts,
} from "../src/auth/passwordAttempts";
import { SecurityConfig } from "../src/auth/security";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const PASSWORD = "correct-horse-battery";
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

function makeContext(sessionVersion = 0) {
  const audits: any[] = [];
  const account = {
    id: "me_1",
    email: "me@example.test",
    name: "Me",
    password: passwordHash,
    role: "USER",
    isActive: true,
    sessionVersion,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const lookups: string[] = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => {
        lookups.push(where.email);
        return where.email === account.email ? { ...account } : null;
      },
    },
    securityAuditLog: {
      create: async ({ data }: any) => (audits.push(data), data),
    },
  };
  return {
    context: {
      user: null,
      prisma,
      req: { ip: "10.0.0.1", headers: {} },
    } as any,
    audits,
    lookups,
  };
}

const login = (email: string, password: string) =>
  `mutation { login(email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)}) { token } }`;

async function exec(context: any, source: string) {
  const result: any = await graphql({ schema, source, contextValue: context });
  return {
    result,
    code: result.errors?.[0]?.extensions?.code,
    message: String(result.errors?.[0]?.message),
  };
}

const WRONG = /^invalid email or password$/i;
const LOCKED = /too many sign-in attempts/i;

async function fiveWrongPasswordsLockTheAccountEvenForTheRightOne() {
  resetAllFailedAttempts();
  const { context } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
    assert.match(
      (await exec(context, login("me@example.test", `wrong-${i}`))).message,
      WRONG,
    );
  }
  const locked = await exec(context, login("me@example.test", PASSWORD));
  assert.equal(locked.code, "BAD_USER_INPUT");
  assert.match(locked.message, LOCKED);
  assert.equal(locked.result.data, null);
}

async function anUnknownEmailLocksExactlyLikeARealOne() {
  resetAllFailedAttempts();
  const { context, audits } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
    assert.match(
      (await exec(context, login("nobody@example.test", `wrong-${i}`))).message,
      WRONG,
    );
  }
  assert.match(
    (await exec(context, login("nobody@example.test", "anything"))).message,
    LOCKED,
  );
  assert.deepEqual(
    audits,
    [],
    "nothing is written for an email that has no account",
  );
}

async function casingAndSpacesInTheEmailShareOneCount() {
  resetAllFailedAttempts();
  const { context } = makeContext();
  const spellings = [
    "me@example.test",
    " ME@Example.test",
    "me@example.test ",
    "Me@example.TEST",
    "me@EXAMPLE.test",
  ];
  for (const email of spellings)
    assert.match((await exec(context, login(email, "wrong"))).message, WRONG);
  assert.match(
    (await exec(context, login("me@example.test", PASSWORD))).message,
    LOCKED,
  );
}

async function aCorrectLoginClearsTheCount() {
  resetAllFailedAttempts();
  const { context } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++)
    await exec(context, login("me@example.test", "wrong"));
  assert.equal(
    (await exec(context, login("me@example.test", PASSWORD))).result.errors,
    undefined,
  );
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
    assert.match(
      (await exec(context, login("me@example.test", "wrong"))).message,
      WRONG,
    );
  }
}

async function aBurstOfParallelGuessesIsCappedAtTheLimit() {
  resetAllFailedAttempts();
  const { context } = makeContext();
  const sources = Array.from({ length: 30 }, (_, i) =>
    login("me@example.test", i === 11 ? PASSWORD : `wrong-${i}`),
  );
  const outcomes = await Promise.all(
    sources.map((source) => exec(context, source)),
  );
  assert.equal(
    outcomes.filter((o) => LOCKED.test(o.message)).length,
    30 - MAX_FAILED_ATTEMPTS,
  );
}

async function failuresAndTheLockoutAreAuditedByActionOnly() {
  resetAllFailedAttempts();
  const { context, audits } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++)
    await exec(context, login("me@example.test", `guess-${i}`));
  await new Promise((resolve) => setImmediate(resolve));
  const events = audits.map((a) => a.event);
  assert.equal(
    events.filter((e) => e === "PASSWORD_CHECK_FAILED").length,
    MAX_FAILED_ATTEMPTS,
  );
  assert.equal(events.filter((e) => e === "PASSWORD_CHECK_LOCKED").length, 1);
  assert.deepEqual(JSON.parse(audits[0].details), { action: "login" });
  assert.equal(audits[0].userId, "me_1");
  assert.ok(!JSON.stringify(audits).includes("guess-"));
}

async function missingFieldsAreNotGuesses() {
  resetAllFailedAttempts();
  const { context, lookups } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS + 2; i++) {
    assert.match(
      (await exec(context, login("me@example.test", ""))).message,
      /required/i,
    );
  }
  assert.deepEqual(lookups, []);
  assert.equal(
    (await exec(context, login("me@example.test", PASSWORD))).result.errors,
    undefined,
  );
}

async function aNewSignInCarriesTheAccountsCurrentSessionVersion() {
  resetAllFailedAttempts();
  const { context } = makeContext(3);
  const { result } = await exec(context, login("me@example.test", PASSWORD));
  assert.equal(SecurityConfig.verifyToken(result.data.login.token).sv, 3);
}

async function main() {
  await aNewSignInCarriesTheAccountsCurrentSessionVersion();
  await fiveWrongPasswordsLockTheAccountEvenForTheRightOne();
  await anUnknownEmailLocksExactlyLikeARealOne();
  await casingAndSpacesInTheEmailShareOneCount();
  await aCorrectLoginClearsTheCount();
  await aBurstOfParallelGuessesIsCappedAtTheLimit();
  await failuresAndTheLockoutAreAuditedByActionOnly();
  await missingFieldsAreNotGuesses();
  console.log("loginAttempts tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
