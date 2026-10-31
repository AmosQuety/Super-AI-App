import "./support/testEnvironment";
import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const caller = { userId: "me_1", email: "me@example.test", role: "USER" };

function makeContext(user: typeof caller | null = caller) {
  const writes: any[] = [];
  const writeTargets: string[] = [];
  const stored = {
    id: "me_1",
    email: "me@example.test",
    name: "Me",
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
      update: async ({ where, data }: any) => (
        writeTargets.push(where.id),
        writes.push(data),
        { ...stored, ...data }
      ),
      updateMany: async ({ where, data }: any) => (
        writeTargets.push(where.id),
        writes.push(data),
        Object.assign(stored, data),
        { count: 1 }
      ),
    },
  };
  const audit = { create: async () => ({}) };
  return {
    context: { user, prisma: { ...prisma, securityAuditLog: audit } } as any,
    writes,
    writeTargets,
  };
}

async function run(source: string, user: typeof caller | null = caller) {
  const { context, writes, writeTargets } = makeContext(user);
  const result: any = await graphql({ schema, source, contextValue: context });
  return {
    result,
    writes,
    writeTargets,
    code: result.errors?.[0]?.extensions?.code,
    message: result.errors?.[0]?.message,
  };
}

const rename = (name: string) =>
  `mutation { updateProfile(name: ${JSON.stringify(name)}) { id name } }`;
const setPrefs = (prefs: object) =>
  `mutation { updatePreferences(preferences: ${JSON.stringify(prefs).replace(/"([a-zA-Z]+)":/g, "$1:")}) { id preferences { tone role goals language } } }`;

async function aNameIsTrimmedAndStored() {
  const { result, writes } = await run(rename("  Ada Lovelace  "));
  assert.equal(result.errors, undefined);
  assert.equal(writes[0].name, "Ada Lovelace");
}

async function anEmptyOrOverlongNameIsRefusedWithoutWriting() {
  for (const bad of ["", "   ", "x".repeat(101)]) {
    const { code, writes } = await run(rename(bad));
    assert.equal(code, "BAD_USER_INPUT", JSON.stringify(bad.slice(0, 10)));
    assert.deepEqual(writes, []);
  }
  const edge = await run(rename("x".repeat(100)));
  assert.equal(edge.result.errors, undefined);
}

async function profileEditsNeedASession() {
  const { code } = await run(rename("Ada"), null);
  assert.equal(code, "UNAUTHENTICATED");
}

async function theFixedChoiceSettingsOnlyTakeTheirKnownValues() {
  const valid = {
    tone: "formal",
    detail: "concise",
    techDepth: "expert",
    responseFormat: "bullets",
  };
  const ok = await run(setPrefs(valid));
  assert.equal(ok.result.errors, undefined);
  assert.deepEqual(JSON.parse(ok.writes[0].preferences), valid);

  for (const [key, value] of [
    ["tone", "rude"],
    ["detail", "x"],
    ["techDepth", "wizard"],
    ["responseFormat", "poem"],
    ["tone", ""],
  ]) {
    const { code, writes } = await run(setPrefs({ [key]: value }));
    assert.equal(code, "BAD_USER_INPUT", `${key}=${value}`);
    assert.deepEqual(writes, [], `${key}=${value}`);
  }
}

async function overlongFreeTextIsRefusedWithoutWriting() {
  for (const key of ["role", "domain", "goals", "language"]) {
    const { code, writes } = await run(setPrefs({ [key]: "r".repeat(301) }));
    assert.equal(code, "BAD_USER_INPUT", key);
    assert.deepEqual(writes, [], key);
  }
  const edge = await run(setPrefs({ role: "r".repeat(300) }));
  assert.equal(edge.result.errors, undefined);
}

async function savedPreferencesComeBackFromTheMutation() {
  const { result, writes } = await run(
    setPrefs({ tone: "formal", role: "QA", goals: "ship it" }),
  );
  assert.equal(result.errors, undefined);
  assert.deepEqual(JSON.parse(writes[0].preferences), {
    tone: "formal",
    role: "QA",
    goals: "ship it",
  });
  assert.equal(result.data.updatePreferences.preferences.tone, "formal");
  assert.equal(result.data.updatePreferences.preferences.role, "QA");
}

async function eachMutationOnlyWritesTheCallersOwnRecord() {
  const rename_ = await run(rename("Ada"));
  assert.deepEqual(rename_.writeTargets, [caller.userId]);
  const prefs = await run(setPrefs({ tone: "formal" }));
  assert.deepEqual(prefs.writeTargets, [caller.userId]);
}

async function preferenceEditsNeedASession() {
  const { code, writes } = await run(setPrefs({ tone: "formal" }), null);
  assert.equal(code, "UNAUTHENTICATED");
  assert.deepEqual(writes, []);
}

async function aNullNameIsAValidationErrorNotACrash() {
  const { code, writes } = await run(
    `mutation { updateProfile(name: null) { id } }`,
  );
  assert.equal(code, "BAD_USER_INPUT");
  assert.deepEqual(writes, []);
}

async function main() {
  await aNameIsTrimmedAndStored();
  await anEmptyOrOverlongNameIsRefusedWithoutWriting();
  await profileEditsNeedASession();
  await theFixedChoiceSettingsOnlyTakeTheirKnownValues();
  await overlongFreeTextIsRefusedWithoutWriting();
  await savedPreferencesComeBackFromTheMutation();
  await eachMutationOnlyWritesTheCallersOwnRecord();
  await preferenceEditsNeedASession();
  await aNullNameIsAValidationErrorNotACrash();
  console.log("profileSettings tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
