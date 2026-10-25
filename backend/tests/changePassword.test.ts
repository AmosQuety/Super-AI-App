import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { closeUserSockets, trackUserSocket } from "../src/auth/socketRegistry";

const CURRENT = "current-password-1";
const MUTATION = `mutation($c: String!, $n: String!) {
  changePassword(currentPassword: $c, newPassword: $n) { success message }
}`;

const signedIn = { userId: "user_1", email: "u1@example.test", role: "USER" };

const auditRecords: any[] = [];
let auditShouldFail = false;

function makeContext(options: { user: typeof signedIn | null; storedUser: boolean; rowChangedMeanwhile?: boolean }) {
  const updates: unknown[] = [];
  const stored = { id: "user_1", email: "u1@example.test", password: bcrypt.hashSync(CURRENT, 4) };
  const context = {
    user: options.user,
    req: { ip: "10.1.2.3", headers: { "user-agent": "test-agent/1.0" } },
    prisma: {
      securityAuditLog: {
        create: async (args: any) => {
          if (auditShouldFail) throw new Error("audit store unavailable");
          auditRecords.push(args.data);
          return args.data;
        },
      },
      user: {
        findUnique: async () => (options.storedUser ? stored : null),
        // Conditional write: it matches only while the stored hash is still the one that was verified.
        updateMany: async (args: unknown) => {
          updates.push(args);
          return { count: options.rowChangedMeanwhile ? 0 : 1 };
        },
      },
    },
  };
  return { context: context as any, updates };
}

async function run(variables: { c: string; n: string }, options: Parameters<typeof makeContext>[0]) {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const { context, updates } = makeContext(options);
  const result: any = await graphql({ schema, source: MUTATION, variableValues: variables, contextValue: context });
  return { result, updates };
}

const code = (result: any) => result.errors?.[0]?.extensions?.code;
const message = (result: any) => result.errors?.[0]?.message;

// UNAUTHENTICATED must mean "no valid session", because clients sign the user out on it.
async function aWrongCurrentPasswordIsAnInputErrorNotASessionError() {
  const { result, updates } = await run({ c: "not-the-password", n: "brand-new-password" }, { user: signedIn, storedUser: true });
  assert.equal(code(result), "BAD_USER_INPUT");
  assert.equal(message(result), "Current password is incorrect");
  assert.equal(updates.length, 0);
}

async function aMissingSessionOrDeletedUserIsUnauthenticated() {
  const anonymous = await run({ c: CURRENT, n: "brand-new-password" }, { user: null, storedUser: true });
  assert.equal(code(anonymous.result), "UNAUTHENTICATED");

  const deleted = await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: false });
  assert.equal(code(deleted.result), "UNAUTHENTICATED");
  assert.equal(deleted.updates.length, 0);
}

async function newPasswordRulesAreInputErrors() {
  const short = await run({ c: CURRENT, n: "1234567" }, { user: signedIn, storedUser: true });
  assert.equal(code(short.result), "BAD_USER_INPUT");
  assert.equal(short.updates.length, 0);

  const same = await run({ c: CURRENT, n: CURRENT }, { user: signedIn, storedUser: true });
  assert.equal(code(same.result), "BAD_USER_INPUT");
  assert.match(String(message(same.result)), /different/);
  assert.equal(same.updates.length, 0);
}

async function aValidChangeStoresOnlyAHashOfTheNewPassword() {
  const { result, updates } = await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: true });
  assert.equal(result.errors, undefined);
  assert.equal(result.data.changePassword.success, true);
  assert.equal(updates.length, 1);
  const stored = (updates[0] as any).data.password as string;
  assert.notEqual(stored, "brand-new-password");
  assert.equal(await bcrypt.compare("brand-new-password", stored), true);
}

// Two simultaneous changes must not both report success: the loser's new password would
// not be stored and the token it was handed would already be dead.
async function aChangeRacingAnotherOneIsRefusedNotReportedAsSuccess() {
  const { result } = await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: true, rowChangedMeanwhile: true });
  assert.equal(code(result), "BAD_USER_INPUT");
  assert.match(String(message(result)), /changed.*another/i);
  assert.equal(result.data, null);
}

async function theWriteIsConditionalOnTheVerifiedHash() {
  const { updates } = await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: true });
  const where = (updates[0] as any).where;
  assert.equal(where.id, "user_1");
  assert.equal(typeof where.password, "string", "the old hash is part of the write condition");
}

class FakeSocket {
  closedWith: number | null = null;
  close(code: number) {
    this.closedWith = code;
  }
  once() {}
}

async function aChangeEndsTheUsersOpenSubscriptionsButNotAnotherUsers() {
  const mine = new FakeSocket();
  const theirs = new FakeSocket();
  trackUserSocket("user_1", mine as any);
  trackUserSocket("user_2", theirs as any);
  await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: true });
  assert.equal(mine.closedWith, 4401);
  assert.equal(theirs.closedWith, null);
  closeUserSockets("user_2");
}

async function aFailedChangeLeavesSubscriptionsOpen() {
  const mine = new FakeSocket();
  trackUserSocket("user_1", mine as any);
  await run({ c: "not-the-password", n: "brand-new-password" }, { user: signedIn, storedUser: true });
  assert.equal(mine.closedWith, null);
  closeUserSockets("user_1");
}

// The audit trail says who changed what and from where, and never holds a password or a hash.
async function aChangeIsWrittenToTheAuditLogWithoutAnySecret() {
  auditRecords.length = 0;
  await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: true });
  assert.equal(auditRecords.length, 1);
  const record = auditRecords[0];
  assert.equal(record.event, "PASSWORD_CHANGED");
  assert.equal(record.userId, "user_1");
  assert.equal(record.userEmail, "u1@example.test");
  assert.equal(record.ipAddress, "10.1.2.3");
  assert.equal(record.userAgent, "test-agent/1.0");
  const everything = JSON.stringify(record);
  assert.equal(everything.includes("brand-new-password"), false);
  assert.equal(everything.includes(CURRENT), false);
  assert.equal(/\$2[aby]\$/.test(everything), false, "no bcrypt hash");
}

async function aRefusedChangeIsNotWrittenAsAChange() {
  auditRecords.length = 0;
  await run({ c: "not-the-password", n: "brand-new-password" }, { user: signedIn, storedUser: true });
  assert.equal(auditRecords.length, 0);
}

// The password has already changed by then, so a broken audit store must not report a failure.
async function anAuditFailureDoesNotUndoOrFailTheChange() {
  auditShouldFail = true;
  const { result } = await run({ c: CURRENT, n: "brand-new-password" }, { user: signedIn, storedUser: true });
  auditShouldFail = false;
  assert.equal(result.errors, undefined);
  assert.equal(result.data.changePassword.success, true);
}

async function main() {
  await aChangeEndsTheUsersOpenSubscriptionsButNotAnotherUsers();
  await aFailedChangeLeavesSubscriptionsOpen();
  await aChangeIsWrittenToTheAuditLogWithoutAnySecret();
  await aRefusedChangeIsNotWrittenAsAChange();
  await anAuditFailureDoesNotUndoOrFailTheChange();
  await aChangeRacingAnotherOneIsRefusedNotReportedAsSuccess();
  await theWriteIsConditionalOnTheVerifiedHash();
  await aWrongCurrentPasswordIsAnInputErrorNotASessionError();
  await aMissingSessionOrDeletedUserIsUnauthenticated();
  await newPasswordRulesAreInputErrors();
  await aValidChangeStoresOnlyAHashOfTheNewPassword();
  console.log("changePassword tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
