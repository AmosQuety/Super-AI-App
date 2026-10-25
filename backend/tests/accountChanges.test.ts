import "./support/testEnvironment";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { resetAllFailedAttempts } from "../src/auth/passwordAttempts";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const caller = { userId: "me_1", email: "me@example.test", role: "USER" };
const PASSWORD = "correct-horse-battery";
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

interface Options {
  preferences?: object | null;
  otherUserEmail?: string;
  failAudit?: boolean;
  storedEmail?: string;
  rawPreferences?: string;
  failUpdateWith?: { code: string };
}

function makeContext(options: Options = {}) {
  const writes: any[] = [];
  const audits: any[] = [];
  const stored = {
    id: "me_1",
    email: options.storedEmail ?? "me@example.test",
    name: "Me",
    password: passwordHash,
    role: "USER",
    preferences:
      options.rawPreferences ??
      (options.preferences ? JSON.stringify(options.preferences) : null),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.id === stored.id) return { ...stored };
        if (where.email === options.otherUserEmail)
          return { ...stored, id: "other_9" };
        return null;
      },
      update: async ({ data }: any) => {
        if (options.failUpdateWith)
          throw Object.assign(new Error("unique"), options.failUpdateWith);
        writes.push(data);
        return { ...stored, ...data };
      },
      // The write applies only if the preferences are still what the caller read.
      updateMany: async ({ where, data }: any) => {
        if (where.preferences !== stored.preferences) return { count: 0 };
        writes.push(data);
        Object.assign(stored, data);
        return { count: 1 };
      },
    },
    securityAuditLog: {
      create: async ({ data }: any) => {
        if (options.failAudit) throw new Error("audit store down");
        audits.push(data);
        return data;
      },
    },
  };
  return {
    context: {
      user: caller,
      prisma,
      req: { ip: "10.0.0.1", headers: {} },
    } as any,
    writes,
    audits,
    stored,
  };
}

async function run(source: string, options: Options = {}) {
  resetAllFailedAttempts();
  const { context, writes, audits } = makeContext(options);
  const result: any = await graphql({ schema, source, contextValue: context });
  return {
    result,
    writes,
    audits,
    code: result.errors?.[0]?.extensions?.code,
    message: result.errors?.[0]?.message,
  };
}

const changeEmail = (email: string, currentPassword?: string) =>
  `mutation { updateProfile(email: ${JSON.stringify(email)}${
    currentPassword === undefined
      ? ""
      : `, currentPassword: ${JSON.stringify(currentPassword)}`
  }) { id email } }`;
const setPrefs = (prefs: string) =>
  `mutation { updatePreferences(preferences: { ${prefs} }) { preferences { tone role goals language } } }`;

async function anEmailChangeNeedsTheCurrentPassword() {
  const missing = await run(changeEmail("new@example.test"));
  assert.equal(missing.code, "BAD_USER_INPUT");
  assert.deepEqual(missing.writes, []);

  const wrong = await run(changeEmail("new@example.test", "not-my-password"));
  assert.equal(wrong.code, "BAD_USER_INPUT");
  assert.match(String(wrong.message), /current password is incorrect/i);
  assert.deepEqual(wrong.writes, []);
  assert.deepEqual(
    wrong.audits.map((a) => a.event),
    ["PASSWORD_CHECK_FAILED"],
  );

  const right = await run(changeEmail("  New@Example.test ", PASSWORD));
  assert.equal(right.result.errors, undefined);
  assert.equal(right.writes[0].email, "new@example.test");
}

async function resendingTheSameEmailIsNotAnEmailChange() {
  const { result, writes, audits } = await run(changeEmail("ME@example.test"));
  assert.equal(result.errors, undefined);
  assert.deepEqual(writes, [{}]);
  assert.deepEqual(
    audits.map((a) => a.event),
    [],
  );
}

async function anEmailAlreadyInUseIsStillRefused() {
  const { code, writes } = await run(
    changeEmail("taken@example.test", PASSWORD),
    {
      otherUserEmail: "taken@example.test",
    },
  );
  assert.equal(code, "BAD_USER_INPUT");
  assert.deepEqual(writes, []);
}

async function preferencesAreMergedIntoWhatIsStored() {
  const before = { tone: "casual", role: "QA", language: "English" };
  const { result, writes } = await run(setPrefs('tone: "formal"'), {
    preferences: before,
  });
  assert.equal(result.errors, undefined);
  assert.deepEqual(JSON.parse(writes[0].preferences), {
    tone: "formal",
    role: "QA",
    language: "English",
  });
  assert.equal(result.data.updatePreferences.preferences.role, "QA");
}

async function aBrokenStoredRecordDoesNotBlockASave() {
  const { result, writes } = await run(setPrefs('tone: "formal"'), {
    rawPreferences: "{not json",
  });
  assert.equal(result.errors, undefined);
  assert.deepEqual(JSON.parse(writes[0].preferences), { tone: "formal" });
}

async function changesAreAuditedByFieldNameNeverByValue() {
  const name = await run(
    `mutation { updateProfile(name: "Secret Person") { id } }`,
  );
  assert.equal(name.audits.length, 1);
  assert.equal(name.audits[0].event, "PROFILE_UPDATED");
  assert.equal(name.audits[0].userId, "me_1");
  assert.deepEqual(JSON.parse(name.audits[0].details), { changed: ["name"] });
  assert.ok(!JSON.stringify(name.audits).includes("Secret Person"));

  const email = await run(changeEmail("new@example.test", PASSWORD));
  assert.equal(email.audits[0].event, "EMAIL_CHANGED");
  assert.equal(email.audits[0].userEmail, "me@example.test");
  assert.ok(!JSON.stringify(email.audits).includes(PASSWORD));

  const prefs = await run(setPrefs('role: "Very private job", tone: "formal"'));
  assert.equal(prefs.audits[0].event, "PREFERENCES_UPDATED");
  assert.deepEqual(JSON.parse(prefs.audits[0].details), {
    changed: ["tone", "role"].sort(),
  });
  assert.ok(!JSON.stringify(prefs.audits).includes("Very private job"));
}

async function aRefusedChangeLeavesNoAuditRecord() {
  const refused = await run(`mutation { updateProfile(name: "   ") { id } }`);
  assert.deepEqual(refused.audits, []);
  const badPref = await run(setPrefs('tone: "rude"'));
  assert.deepEqual(badPref.audits, []);
}

async function aBrokenAuditStoreDoesNotFailASavedChange() {
  const { result, writes } = await run(
    `mutation { updateProfile(name: "Ada") { id name } }`,
    { failAudit: true },
  );
  assert.equal(result.errors, undefined);
  assert.equal(writes[0].name, "Ada");
}

async function resendingTheSameNameIsNotAuditedAsARename() {
  const { result, audits } = await run(
    `mutation { updateProfile(name: "Me", email: "me@example.test") { id } }`,
  );
  assert.equal(result.errors, undefined);
  assert.deepEqual(audits, []);
}

async function aStoredEmailWithCapitalsIsStillTheSameAddress() {
  const { result, audits } = await run(
    `mutation { updateProfile(name: "New", email: "Me@Example.test") { id } }`,
    { storedEmail: "Me@Example.test" },
  );
  assert.equal(result.errors, undefined);
  assert.deepEqual(
    audits.map((a) => a.event),
    ["PROFILE_UPDATED"],
  );
}

async function thePasswordIsCheckedBeforeAnyEmailIsDisclosedAsTaken() {
  const wrong = await run(
    changeEmail("taken@example.test", "not-my-password"),
    { otherUserEmail: "taken@example.test" },
  );
  assert.match(String(wrong.message), /current password is incorrect/i);
  const empty = await run(changeEmail("new@example.test", ""));
  assert.equal(empty.code, "BAD_USER_INPUT");
  assert.deepEqual(empty.writes, []);
  assert.deepEqual(empty.audits, []);
}

async function aRaceForTheSameAddressAnswersLikeAClash() {
  const { code, message } = await run(
    changeEmail("new@example.test", PASSWORD),
    { failUpdateWith: { code: "P2002" } },
  );
  assert.equal(code, "BAD_USER_INPUT");
  assert.match(String(message), /already taken/i);
}

async function twoDevicesSavingAtOnceKeepBothChanges() {
  const { context, stored } = makeContext({
    preferences: { tone: "casual", detail: "concise" },
  });
  const [first, second]: any[] = await Promise.all([
    graphql({
      schema,
      source: setPrefs('tone: "formal"'),
      contextValue: context,
    }),
    graphql({
      schema,
      source: setPrefs('detail: "detailed"'),
      contextValue: context,
    }),
  ]);
  assert.equal(first.errors, undefined);
  assert.equal(second.errors, undefined);
  assert.deepEqual(JSON.parse(stored.preferences as string), {
    tone: "formal",
    detail: "detailed",
  });
}

async function oldInvalidStoredValuesAreDroppedOnTheNextSave() {
  const raw = JSON.stringify({
    tone: "whatever",
    language: 5,
    role: "QA",
    extra: "x",
  });
  const { result, writes } = await run(setPrefs('detail: "concise"'), {
    rawPreferences: raw,
  });
  assert.equal(result.errors, undefined);
  assert.deepEqual(JSON.parse(writes[0].preferences), {
    role: "QA",
    detail: "concise",
  });
}

async function anEmptyUpdateWritesAndAuditsNothing() {
  const { result, writes, audits } = await run(
    `mutation { updatePreferences(preferences: {}) { id } }`,
  );
  assert.equal(result.errors, undefined);
  assert.deepEqual(writes, []);
  assert.deepEqual(audits, []);
}

async function savingTheSameSettingsAgainChangesAndAuditsNothing() {
  const before = { tone: "formal", role: "QA" };
  const same = await run(setPrefs('tone: "formal", role: "QA"'), {
    preferences: before,
  });
  assert.equal(same.result.errors, undefined);
  assert.deepEqual(same.writes, []);
  assert.deepEqual(same.audits, []);

  const one = await run(setPrefs('tone: "formal", role: "Lead"'), {
    preferences: before,
  });
  assert.deepEqual(JSON.parse(one.audits[0].details), { changed: ["role"] });
}

async function main() {
  await anEmailChangeNeedsTheCurrentPassword();
  await resendingTheSameEmailIsNotAnEmailChange();
  await anEmailAlreadyInUseIsStillRefused();
  await preferencesAreMergedIntoWhatIsStored();
  await aBrokenStoredRecordDoesNotBlockASave();
  await changesAreAuditedByFieldNameNeverByValue();
  await aRefusedChangeLeavesNoAuditRecord();
  await aBrokenAuditStoreDoesNotFailASavedChange();
  await resendingTheSameNameIsNotAuditedAsARename();
  await aStoredEmailWithCapitalsIsStillTheSameAddress();
  await thePasswordIsCheckedBeforeAnyEmailIsDisclosedAsTaken();
  await aRaceForTheSameAddressAnswersLikeAClash();
  await twoDevicesSavingAtOnceKeepBothChanges();
  await oldInvalidStoredValuesAreDroppedOnTheNextSave();
  await anEmptyUpdateWritesAndAuditsNothing();
  await savingTheSameSettingsAgainChangesAndAuditsNothing();
  console.log("accountChanges tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
