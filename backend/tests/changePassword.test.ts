import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";

const CURRENT = "current-password-1";
const MUTATION = `mutation($c: String!, $n: String!) {
  changePassword(currentPassword: $c, newPassword: $n) { success message }
}`;

const signedIn = { userId: "user_1", email: "u1@example.test", role: "USER" };

function makeContext(options: { user: typeof signedIn | null; storedUser: boolean }) {
  const updates: unknown[] = [];
  const stored = { id: "user_1", password: bcrypt.hashSync(CURRENT, 4) };
  const context = {
    user: options.user,
    prisma: {
      user: {
        findUnique: async () => (options.storedUser ? stored : null),
        update: async (args: unknown) => {
          updates.push(args);
          return stored;
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

async function main() {
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
