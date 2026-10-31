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
  trackedKeyCount,
} from "../src/auth/passwordAttempts";
import { MAX_ATTEMPTS_PER_EMAIL } from "../src/auth/signInAttempts";
import { MAX_UNKNOWN_EMAIL_AUDIT_ROWS } from "../src/auth/signInFailure";
import { setSecurityMetricSink } from "../src/utils/securityMetrics";
import { SecurityConfig } from "../src/auth/security";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const PASSWORD = "correct-horse-battery";
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

interface ContextOptions {
  ip?: string;
  isActive?: boolean;
}

function makeContext(sessionVersion = 0, options: ContextOptions = {}) {
  const audits: any[] = [];
  const account = {
    id: "me_1",
    email: "me@example.test",
    name: "Me",
    password: passwordHash,
    role: "USER",
    isActive: options.isActive ?? true,
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
      req: { ip: options.ip ?? "10.0.0.1", headers: {} },
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
  await new Promise((resolve) => setImmediate(resolve));
  const failed = audits.filter((a) => a.event === "PASSWORD_CHECK_FAILED");
  assert.equal(failed.length, MAX_FAILED_ATTEMPTS, "stuffing is visible");
  assert.equal(audits.filter((a) => a.event === "PASSWORD_CHECK_LOCKED").length, 1);
  assert.equal(failed[0].userId, null);
  assert.equal(failed[0].userEmail, null);
  assert.equal(failed[0].ipAddress, "10.0.0.1");
  assert.deepEqual(JSON.parse(failed[0].details), {
    action: "login",
    knownAccount: false,
  });
  assert.ok(
    !JSON.stringify(audits).includes("nobody@example.test") &&
      !JSON.stringify(audits).includes("wrong-"),
    "neither the typed email nor the typed password is stored",
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

async function aStrangersGuessesDoNotLockTheOwnerOutFromAnotherAddress() {
  resetAllFailedAttempts();
  const attacker = makeContext(0, { ip: "203.0.113.9" }).context;
  const owner = makeContext(0, { ip: "198.51.100.7" }).context;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++)
    await exec(attacker, login("me@example.test", `guess-${i}`));
  assert.match(
    (await exec(attacker, login("me@example.test", PASSWORD))).message,
    LOCKED,
    "the attacker's own address is locked",
  );
  assert.equal(
    (await exec(owner, login("me@example.test", PASSWORD))).result.errors,
    undefined,
    "the owner signs in from their own address",
  );
}

async function addressesInOneIpv6NetworkShareOneCountAndLeaveTheOwnerAlone() {
  resetAllFailedAttempts();
  // Four addresses of one /64, five wrong guesses each: 20 requests, one client.
  for (let host = 1; host <= 4; host++) {
    const { context } = makeContext(0, { ip: `2001:db8:1:2::${host}` });
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++)
      await exec(context, login("me@example.test", `guess-${host}-${i}`));
  }
  const attackerAgain = makeContext(0, { ip: "2001:db8:1:2::99" }).context;
  assert.match(
    (await exec(attackerAgain, login("me@example.test", "x"))).message,
    LOCKED,
    "the whole /64 is one client with one count of 5",
  );
  const owner = makeContext(0, { ip: "198.51.100.7" }).context;
  assert.equal(
    (await exec(owner, login("me@example.test", PASSWORD))).result.errors,
    undefined,
    "the ceiling was not used up by the /64, so the owner signs in",
  );
}

async function manyAddressesStillHitTheCeilingForOneEmail() {
  resetAllFailedAttempts();
  const guesses = MAX_ATTEMPTS_PER_EMAIL;
  for (let i = 0; i < guesses; i++) {
    const { context } = makeContext(0, { ip: `192.0.2.${i}` });
    assert.match((await exec(context, login("me@example.test", "bad"))).message, WRONG);
  }
  const { context: fresh } = makeContext(0, { ip: "192.0.2.250" });
  assert.match(
    (await exec(fresh, login("me@example.test", PASSWORD))).message,
    LOCKED,
    "one email cannot be guessed at without limit by rotating addresses",
  );
}

async function aRefusalByTheCeilingDoesNotUseUpTheAddressOwnCount() {
  resetAllFailedAttempts();
  for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i++) {
    const { context } = makeContext(0, { ip: `192.0.2.${i}` });
    await exec(context, login("me@example.test", "bad"));
  }
  const tracked = trackedKeyCount();
  const { context } = makeContext(0, { ip: "192.0.2.250" });
  for (let i = 0; i < 3; i++) {
    assert.match((await exec(context, login("me@example.test", PASSWORD))).message, LOCKED);
  }
  assert.equal(trackedKeyCount(), tracked, "refused attempts left no count behind");
}

async function successfulSignInsDoNotUseUpTheCeiling() {
  resetAllFailedAttempts();
  for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL + 5; i++) {
    const { context } = makeContext(0, { ip: `192.0.2.${i}` });
    assert.equal(
      (await exec(context, login("me@example.test", PASSWORD))).result.errors,
      undefined,
    );
  }
}

async function aDisabledAccountIsAuditedAsRefusedNotAsAWrongPassword() {
  resetAllFailedAttempts();
  const { context, audits } = makeContext(0, { isActive: false });
  const refused = await exec(context, login("me@example.test", PASSWORD));
  assert.match(refused.message, WRONG, "the caller sees the generic refusal");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    audits.map((a) => a.event),
    ["LOGIN_REFUSED_DISABLED"],
  );
}

async function anOverlongEmailIsRefusedWithoutBeingTracked() {
  resetAllFailedAttempts();
  const { context, lookups } = makeContext();
  const huge = `${"a".repeat(300)}@example.test`;
  assert.match((await exec(context, login(huge, "x"))).message, WRONG);
  assert.equal(trackedKeyCount(), 0);
  assert.deepEqual(lookups, []);
}

async function unknownEmailAuditRowsPerNetworkAreCappedButEveryFailureIsCounted() {
  resetAllFailedAttempts();
  const counted: string[] = [];
  setSecurityMetricSink((name, attributes) =>
    counted.push(`${name}:${JSON.stringify(attributes)}`),
  );
  try {
    const stuffer = makeContext(0, { ip: "203.0.113.50" });
    const attempts = MAX_UNKNOWN_EMAIL_AUDIT_ROWS * 2;
    for (let i = 0; i < attempts; i++)
      await exec(stuffer.context, login(`nobody-${i}@example.test`, "bad"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      stuffer.audits.filter((a) => a.userId === null).length,
      MAX_UNKNOWN_EMAIL_AUDIT_ROWS,
      "one network cannot write unlimited rows",
    );
    assert.equal(
      counted.filter((c) => c === 'auth.sign_in.failed:{"reason":"unknown_email"}').length,
      attempts,
      "the metric still sees every failure",
    );

    const another = makeContext(0, { ip: "198.51.100.51" });
    await exec(another.context, login("someone@example.test", "bad"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(another.audits.length, 1, "another network has its own budget");
  } finally {
    setSecurityMetricSink(undefined);
  }
}

async function failuresAndLocksAreCountedAsMetricsWithoutPersonalData() {
  resetAllFailedAttempts();
  const counted: Array<{ name: string; attributes: object }> = [];
  setSecurityMetricSink((name, attributes) => counted.push({ name, attributes }));
  try {
    const { context } = makeContext();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await exec(context, login("nobody@example.test", "bad"));
    }
    await exec(context, login("me@example.test", "bad"));
    await exec(context, login("nobody@example.test", "bad"));
  } finally {
    setSecurityMetricSink(undefined);
  }
  const names = counted.map((c) => `${c.name}:${JSON.stringify(c.attributes)}`);
  assert.equal(
    names.filter((n) => n === 'auth.sign_in.failed:{"reason":"unknown_email"}').length,
    MAX_FAILED_ATTEMPTS,
  );
  assert.equal(
    names.filter((n) => n === 'auth.sign_in.failed:{"reason":"wrong_password"}').length,
    1,
  );
  assert.ok(names.includes('auth.sign_in.locked:{"scope":"address"}'));
  assert.ok(!JSON.stringify(counted).includes("example.test"));
}

async function main() {
  await aStrangersGuessesDoNotLockTheOwnerOutFromAnotherAddress();
  await addressesInOneIpv6NetworkShareOneCountAndLeaveTheOwnerAlone();
  await manyAddressesStillHitTheCeilingForOneEmail();
  await successfulSignInsDoNotUseUpTheCeiling();
  await aRefusalByTheCeilingDoesNotUseUpTheAddressOwnCount();
  await aDisabledAccountIsAuditedAsRefusedNotAsAWrongPassword();
  await anOverlongEmailIsRefusedWithoutBeingTracked();
  await unknownEmailAuditRowsPerNetworkAreCappedButEveryFailureIsCounted();
  await failuresAndLocksAreCountedAsMetricsWithoutPersonalData();
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
