import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";

const schema = makeExecutableSchema({ typeDefs, resolvers });

const ASCII_72 = "a".repeat(72);
const ASCII_73 = "a".repeat(73);
// "é" is 2 bytes in UTF-8, so 36 of them fill the limit exactly and 37 go over it.
const TWO_BYTE_36 = "é".repeat(36);
const TWO_BYTE_37 = "é".repeat(37);
// An emoji is 4 bytes: 18 of them are 72 bytes, 19 are 76.
const EMOJI_18 = "😀".repeat(18);
const EMOJI_19 = "😀".repeat(19);

const REGISTER = `mutation($p: String!) { register(email: "u1@example.test", password: $p, name: "U") { token } }`;
const CHANGE = `mutation($c: String!, $n: String!) { changePassword(currentPassword: $c, newPassword: $n) { success } }`;
const LOGIN = `mutation($p: String!) { login(email: "u1@example.test", password: $p) { token } }`;

const code = (result: any) => result.errors?.[0]?.extensions?.code;

async function register(password: string) {
  const writes: unknown[] = [];
  const prisma = {
    user: {
      findUnique: async () => null,
      create: async (args: any) => {
        writes.push(args);
        return { id: "u1", email: "u1@example.test", name: "U", role: "USER", isActive: true, password: args.data.password };
      },
    },
  };
  const result: any = await graphql({ schema, source: REGISTER, variableValues: { p: password }, contextValue: { prisma, user: null } });
  return { result, writes };
}

async function changePassword(current: string, next: string) {
  const writes: unknown[] = [];
  const stored = { id: "u1", email: "u1@example.test", role: "USER", password: bcrypt.hashSync(current, 4) };
  const prisma = { user: { findUnique: async () => stored, update: async (args: unknown) => (writes.push(args), stored) } };
  const user = { userId: "u1", email: "u1@example.test", role: "USER" };
  const result: any = await graphql({ schema, source: CHANGE, variableValues: { c: current, n: next }, contextValue: { prisma, user } });
  return { result, writes };
}

// Why the cap exists: bcrypt only reads the first 72 bytes, so anything after is not protected.
async function bcryptIgnoresEverythingAfterTheSeventySecondByte() {
  const hash = bcrypt.hashSync(ASCII_72, 4);
  assert.equal(await bcrypt.compare(ASCII_73, hash), true);
}

async function registerAcceptsExactlyTheLimitAndRejectsOneByteMore() {
  for (const ok of [ASCII_72, TWO_BYTE_36, EMOJI_18]) {
    const { result, writes } = await register(ok);
    assert.equal(result.errors, undefined, `accepted ${Buffer.byteLength(ok)} bytes`);
    assert.equal(writes.length, 1);
  }
  for (const tooLong of [ASCII_73, TWO_BYTE_37, EMOJI_19]) {
    const { result, writes } = await register(tooLong);
    assert.equal(code(result), "BAD_USER_INPUT", `rejected ${Buffer.byteLength(tooLong)} bytes`);
    assert.match(String(result.errors[0].message), /72 bytes/);
    assert.equal(writes.length, 0);
  }
}

async function changePasswordAcceptsExactlyTheLimitAndRejectsOneByteMore() {
  for (const ok of [ASCII_72, TWO_BYTE_36, EMOJI_18]) {
    const { result, writes } = await changePassword("current-password-1", ok);
    assert.equal(result.errors, undefined, `accepted ${Buffer.byteLength(ok)} bytes`);
    assert.equal(writes.length, 1);
  }
  for (const tooLong of [ASCII_73, TWO_BYTE_37, EMOJI_19]) {
    const { result, writes } = await changePassword("current-password-1", tooLong);
    assert.equal(code(result), "BAD_USER_INPUT", `rejected ${Buffer.byteLength(tooLong)} bytes`);
    assert.match(String(result.errors[0].message), /72 bytes/);
    assert.equal(writes.length, 0);
  }
}

// An older account may have a longer password that still verifies under truncation;
// capping login would lock that user out.
async function loginIsNotCapped() {
  const longPassword = "b".repeat(100);
  const user = { id: "u1", email: "u1@example.test", role: "USER", isActive: true, password: bcrypt.hashSync(longPassword, 4) };
  const prisma = { user: { findUnique: async () => user } };
  const result: any = await graphql({ schema, source: LOGIN, variableValues: { p: longPassword }, contextValue: { prisma, user: null } });
  assert.equal(result.errors, undefined);
  assert.ok(result.data.login.token);
}

async function main() {
  await bcryptIgnoresEverythingAfterTheSeventySecondByte();
  await registerAcceptsExactlyTheLimitAndRejectsOneByteMore();
  await changePasswordAcceptsExactlyTheLimitAndRejectsOneByteMore();
  await loginIsNotCapped();
  console.log("passwordLength tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
