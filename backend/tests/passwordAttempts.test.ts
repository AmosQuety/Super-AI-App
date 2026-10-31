import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_WINDOW_MS,
  reserveAttempt,
  refundAttempt,
  MAX_TRACKED_KEYS,
  trackedKeyCount,
  clearFailedAttempts,
  resetAllFailedAttempts,
} from "../src/auth/passwordAttempts";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const PASSWORD = "correct-horse-battery";
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

function unitCounterBehaviour() {
  resetAllFailedAttempts();
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
    const turn = reserveAttempt("u1", t0 + i);
    assert.deepEqual(turn, { allowed: true, isLastAllowed: false });
  }
  assert.deepEqual(reserveAttempt("u1", t0 + 20), {
    allowed: true,
    isLastAllowed: true,
  });

  const refused = reserveAttempt("u1", t0 + 30);
  assert.ok(!refused.allowed);
  assert.equal(
    refused.allowed === false && refused.retryAfterMs,
    LOCKOUT_WINDOW_MS - 10,
    "the lock runs a full window from the last allowed attempt",
  );
  assert.ok(
    reserveAttempt("u2", t0 + 30).allowed,
    "another user is not affected",
  );

  assert.ok(
    !reserveAttempt("u1", t0 + 20 + LOCKOUT_WINDOW_MS - 1).allowed,
    "still locked just before the end",
  );
  assert.ok(
    reserveAttempt("u1", t0 + 20 + LOCKOUT_WINDOW_MS).allowed,
    "free again after a full window",
  );

  // A correct answer unlocks a user whose window is still open.
  resetAllFailedAttempts();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) reserveAttempt("u3", t0);
  assert.ok(!reserveAttempt("u3", t0 + 1).allowed);
  clearFailedAttempts("u3");
  assert.ok(reserveAttempt("u3", t0 + 2).allowed);
}

interface Setup {
  noPassword?: boolean;
}

function makeContext(setup: Setup = {}) {
  const writes: any[] = [];
  const audits: any[] = [];
  const stored: any = {
    id: "me_1",
    email: "me@example.test",
    name: "Me",
    password: setup.noPassword ? null : passwordHash,
    role: "USER",
    preferences: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    user: {
      findUnique: async ({ where }: any) =>
        where.id === stored.id ? { ...stored } : null,
      update: async ({ data }: any) => (
        writes.push(data),
        { ...stored, ...data }
      ),
      updateMany: async ({ data }: any) => (
        writes.push(data),
        Object.assign(stored, data),
        { count: 1 }
      ),
    },
    securityAuditLog: {
      create: async ({ data }: any) => (audits.push(data), data),
    },
  };
  const user = { userId: "me_1", email: "me@example.test", role: "USER" };
  return {
    context: { user, prisma, req: { ip: "10.0.0.1", headers: {} } } as any,
    writes,
    audits,
  };
}

const changeEmail = (password: string) =>
  `mutation { updateProfile(email: "new@example.test", currentPassword: ${JSON.stringify(password)}) { id } }`;
const changePassword = (current: string) =>
  `mutation { changePassword(currentPassword: ${JSON.stringify(current)}, newPassword: "another-long-password") { success } }`;

async function exec(context: any, source: string) {
  const result: any = await graphql({ schema, source, contextValue: context });
  return {
    result,
    code: result.errors?.[0]?.extensions?.code,
    message: String(result.errors?.[0]?.message),
  };
}

async function wrongPasswordsLockBothMutationsTogether() {
  resetAllFailedAttempts();
  const { context, writes, audits } = makeContext();

  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
    const turn =
      i % 2 === 0 ? changeEmail("wrong-guess") : changePassword("wrong-guess");
    const { code, message } = await exec(context, turn);
    assert.equal(code, "BAD_USER_INPUT");
    assert.match(message, /^current password is incorrect$/i);
  }

  // Locked: even the right password is refused, in either mutation, and nothing is written.
  for (const source of [changeEmail(PASSWORD), changePassword(PASSWORD)]) {
    const { code, message } = await exec(context, source);
    assert.equal(code, "BAD_USER_INPUT");
    assert.match(message, /too many/i);
  }
  assert.deepEqual(writes, []);

  const events = audits.map((a) => a.event);
  assert.equal(
    events.filter((e) => e === "PASSWORD_CHECK_FAILED").length,
    MAX_FAILED_ATTEMPTS,
  );
  assert.equal(events.filter((e) => e === "PASSWORD_CHECK_LOCKED").length, 1);
  const json = JSON.stringify(audits);
  assert.ok(!json.includes("wrong-guess") && !json.includes(PASSWORD));
  assert.deepEqual(JSON.parse(audits[0].details), { action: "change_email" });
  assert.deepEqual(JSON.parse(audits[1].details), {
    action: "change_password",
  });
}

async function aCorrectPasswordClearsTheCount() {
  resetAllFailedAttempts();
  const { context } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++)
    await exec(context, changeEmail("wrong-guess"));
  const ok = await exec(context, changeEmail(PASSWORD));
  assert.equal(ok.result.errors, undefined);
  // The count started again, so there is room for four more wrong guesses.
  for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
    assert.match(
      (await exec(context, changeEmail("wrong-guess"))).message,
      /^current password is incorrect$/i,
    );
  }
}

async function aMissingPasswordIsNotAGuess() {
  resetAllFailedAttempts();
  const { context, audits } = makeContext();
  const noPassword = `mutation { updateProfile(email: "new@example.test") { id } }`;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS + 2; i++) {
    assert.match(
      (await exec(context, noPassword)).message,
      /enter your current password/i,
    );
  }
  assert.deepEqual(audits, []);
  assert.equal(
    (await exec(context, changeEmail(PASSWORD))).result.errors,
    undefined,
  );
}

async function anAccountWithoutAPasswordChangesItsEmailFreely() {
  resetAllFailedAttempts();
  const { context, writes, audits } = makeContext({ noPassword: true });
  const { result } = await exec(
    context,
    `mutation { updateProfile(email: "new@example.test") { id } }`,
  );
  assert.equal(result.errors, undefined);
  assert.equal(writes[0].email, "new@example.test");
  assert.deepEqual(
    audits.map((a) => a.event),
    ["EMAIL_CHANGED"],
  );
}

async function parallelGuessesAreCappedAtTheLimit() {
  resetAllFailedAttempts();
  const { context, writes, audits } = makeContext();
  const guesses = Array.from({ length: 30 }, (_, i) =>
    i === 17 ? changeEmail(PASSWORD) : changeEmail(`wrong-${i}`),
  );
  const outcomes = await Promise.all(
    guesses.map((source) => exec(context, source)),
  );

  const compared = outcomes.filter((o) => !/too many/i.test(o.message));
  assert.equal(
    compared.length,
    MAX_FAILED_ATTEMPTS,
    "only the allowed number of passwords were ever checked",
  );
  assert.equal(
    outcomes.filter((o) => /too many/i.test(o.message)).length,
    30 - MAX_FAILED_ATTEMPTS,
  );
  assert.ok(writes.length <= 1);
  assert.ok(
    audits.filter((a) => a.event === "PASSWORD_CHECK_FAILED").length <=
      MAX_FAILED_ATTEMPTS,
  );
  assert.ok(
    audits.filter((a) => a.event === "PASSWORD_CHECK_LOCKED").length <= 1,
  );
}

async function anEmptyPasswordIsNotAGuessInEitherMutation() {
  resetAllFailedAttempts();
  const { context, audits } = makeContext();
  for (let i = 0; i < MAX_FAILED_ATTEMPTS + 2; i++) {
    assert.match(
      (await exec(context, changePassword(""))).message,
      /enter your current password/i,
    );
    assert.match(
      (await exec(context, changeEmail(""))).message,
      /enter your current password/i,
    );
  }
  assert.deepEqual(audits, []);
  // Nothing was used up: the right password still works.
  assert.equal(
    (await exec(context, changePassword(PASSWORD))).result.errors,
    undefined,
  );
}

function theTableOfTrackedKeysStaysBounded() {
  resetAllFailedAttempts();
  for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++)
    reserveAttempt(`login:stranger-${i}@example.test`, 1_000_000);
  assert.ok(trackedKeyCount() <= MAX_TRACKED_KEYS);
  // A busy table still lets a real, recent key be tracked and locked.
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++)
    reserveAttempt("login:real@example.test", 1_000_001);
  assert.ok(!reserveAttempt("login:real@example.test", 1_000_002).allowed);
}

function aLockSurvivesAFloodOfOtherKeys() {
  resetAllFailedAttempts();
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++)
    reserveAttempt("login:victim@example.test", t0);
  assert.ok(!reserveAttempt("login:victim@example.test", t0 + 1).allowed);

  // The flood arrives AFTER the lock, which is the order an attacker would use.
  for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++)
    reserveAttempt(`login:junk-${i}@example.test`, t0 + 2);

  assert.ok(
    !reserveAttempt("login:victim@example.test", t0 + 3).allowed,
    "a live lock is never evicted to make room",
  );
  assert.ok(trackedKeyCount() <= MAX_TRACKED_KEYS + 1);
}

function aFloodOfSignInKeysNeverTouchesPasswordKeys() {
  resetAllFailedAttempts();
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++)
    reserveAttempt("password:user_1", t0);
  for (let i = 0; i < MAX_TRACKED_KEYS * 2; i++)
    reserveAttempt(`login:junk-${i}@example.test`, t0 + 1);
  assert.ok(
    !reserveAttempt("password:user_1", t0 + 2).allowed,
    "current-password locks live in their own table",
  );
}

function whenOnlyLocksRemainTheOneClosestToExpiryGoesFirst() {
  resetAllFailedAttempts();
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_TRACKED_KEYS; i++) {
    for (let n = 0; n < MAX_FAILED_ATTEMPTS; n++)
      reserveAttempt(`login:locked-${i}`, t0 + i);
  }
  // Table is full of locks; one more key must still be tracked.
  reserveAttempt("login:newcomer", t0 + MAX_TRACKED_KEYS + 1);
  assert.ok(trackedKeyCount() <= MAX_TRACKED_KEYS);
  assert.ok(
    reserveAttempt("login:locked-1", t0 + MAX_TRACKED_KEYS + 2).allowed ===
      false,
    "a later lock is kept while the earliest-expiring one is dropped",
  );
  assert.ok(
    reserveAttempt("login:locked-0", t0 + MAX_TRACKED_KEYS + 3).allowed,
    "the lock closest to expiry was the one dropped",
  );
}

function aFloodOfJunkKeysKeepsTheWindowsWithMostProgress() {
  resetAllFailedAttempts();
  const t0 = 1_000_000;
  for (let i = 0; i < 15; i++) reserveAttempt("loginEmail:owner@x.test", t0, 20);
  for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++)
    reserveAttempt(`loginEmail:junk-${i}@x.test`, t0 + 1, 20);
  for (let i = 0; i < 5; i++)
    assert.ok(reserveAttempt("loginEmail:owner@x.test", t0 + 2, 20).allowed);
  assert.ok(
    !reserveAttempt("loginEmail:owner@x.test", t0 + 3, 20).allowed,
    "15 earlier + 5 more = the limit of 20; the flood did not reset the count",
  );
}

function aCustomLimitAndARefundAreHonoured() {
  resetAllFailedAttempts();
  for (let i = 0; i < 20; i++)
    assert.ok(reserveAttempt("loginEmail:a@x.test", 1_000, 20).allowed);
  assert.ok(!reserveAttempt("loginEmail:a@x.test", 1_001, 20).allowed);

  resetAllFailedAttempts();
  for (let i = 0; i < 3; i++) reserveAttempt("loginEmail:b@x.test", 1_000, 20);
  refundAttempt("loginEmail:b@x.test");
  refundAttempt("loginEmail:never-seen");
  for (let i = 0; i < 18; i++)
    assert.ok(reserveAttempt("loginEmail:b@x.test", 1_001, 20).allowed);
  assert.ok(
    !reserveAttempt("loginEmail:b@x.test", 1_002, 20).allowed,
    "3 reserved, 1 refunded, 18 more = 20 used",
  );
}

async function main() {
  aLockSurvivesAFloodOfOtherKeys();
  aFloodOfSignInKeysNeverTouchesPasswordKeys();
  whenOnlyLocksRemainTheOneClosestToExpiryGoesFirst();
  aCustomLimitAndARefundAreHonoured();
  aFloodOfJunkKeysKeepsTheWindowsWithMostProgress();
  theTableOfTrackedKeysStaysBounded();
  await parallelGuessesAreCappedAtTheLimit();
  await anEmptyPasswordIsNotAGuessInEitherMutation();
  unitCounterBehaviour();
  await wrongPasswordsLockBothMutationsTogether();
  await aCorrectPasswordClearsTheCount();
  await aMissingPasswordIsNotAGuess();
  await anAccountWithoutAPasswordChangesItsEmailFreely();
  console.log("passwordAttempts tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
