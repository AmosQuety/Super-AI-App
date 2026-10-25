import "./support/testEnvironment";
import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";

// Clients sign the user out when an answer carries UNAUTHENTICATED, so asking for someone
// else's chat (or message) must never use that code: the session is fine, the chat is just
// not theirs. It is reported as "not found" so ids cannot be probed.

const schema = makeExecutableSchema({ typeDefs, resolvers });
const caller = { userId: "me_1", email: "me@example.test", role: "USER" };

const chats: Record<string, { id: string; userId: string }> = {
  mine: { id: "mine", userId: "me_1" },
  theirs: { id: "theirs", userId: "other_2" },
};

function makeContext(user: typeof caller | null) {
  const writes: string[] = [];
  const record = (name: string) => async () => {
    writes.push(name);
    return {};
  };
  const prisma = {
    chat: {
      findUnique: async ({ where }: any) => chats[where.id] ?? null,
      create: record("chat.create"),
      update: record("chat.update"),
      delete: record("chat.delete"),
    },
    message: {
      findUnique: async ({ where }: any) =>
        where.id === "their_message" ? { id: "their_message", chat: chats.theirs } : null,
      create: record("message.create"),
      delete: record("message.delete"),
      deleteMany: record("message.deleteMany"),
    },
    user: {
      findUnique: async () => ({ name: "Me", email: "me@example.test", preferences: null }),
    },
  };
  const taskService = {
    createTask: async () => {
      writes.push("task.create");
      return { id: "task_1" };
    },
  };
  return { context: { user, prisma, taskService } as any, writes };
}

async function run(source: string, user: typeof caller | null = caller) {
  const { context, writes } = makeContext(user);
  const result: any = await graphql({ schema, source, contextValue: context });
  return { error: result.errors?.[0], writes };
}

const code = (error: any) => error?.extensions?.code;

async function sendingToSomeoneElsesOrAMissingChatIsNotASessionError() {
  for (const chatId of ["theirs", "missing"]) {
    const { error, writes } = await run(`mutation { sendMessageWithResponse(chatId: "${chatId}", content: "hi") { aiMessage { id } } }`);
    assert.equal(code(error), "BAD_USER_INPUT", chatId);
    assert.equal(error.message, "Chat not found", chatId);
    assert.deepEqual(writes, [], `nothing is written or started for ${chatId}`);
  }
}

async function sendingWithoutASessionIsStillUnauthenticated() {
  const { error } = await run(`mutation { sendMessageWithResponse(chatId: "mine", content: "hi") { aiMessage { id } } }`, null);
  assert.equal(code(error), "UNAUTHENTICATED");
}

async function otherChatMutationsReportNotFoundWithoutWriting() {
  const attempts = [
    `mutation { addMessage(chatId: "theirs", role: "user", content: "x") { id } }`,
    `mutation { updateChat(chatId: "theirs", title: "x") { id } }`,
    `mutation { deleteChat(chatId: "theirs") }`,
  ];
  for (const source of attempts) {
    const { error, writes } = await run(source);
    assert.equal(code(error), "BAD_USER_INPUT", source);
    assert.equal(error.message, "Chat not found", source);
    assert.deepEqual(writes, [], source);
  }
}

async function deletingSomeoneElsesMessageDoesNotSignTheUserOut() {
  const { error, writes } = await run(`mutation { deleteMessage(messageId: "their_message") }`);
  assert.notEqual(code(error), "UNAUTHENTICATED");
  assert.equal(error.message, "Message not found");
  assert.deepEqual(writes, []);
}

async function creatingAChatForAnotherUserIsForbiddenNotUnauthenticated() {
  const { error, writes } = await run(`mutation { createChat(userId: "other_2", title: "x", messages: []) { id } }`);
  assert.equal(code(error), "FORBIDDEN");
  assert.deepEqual(writes, []);
}

async function theOwnerStillWorks() {
  const own = await run(`mutation { deleteChat(chatId: "mine") }`);
  assert.equal(own.error, undefined);
  assert.deepEqual(own.writes, ["message.deleteMany", "chat.delete"]);

  const created = await run(`mutation { createChat(userId: "me_1", title: "x", messages: []) { __typename } }`);
  assert.deepEqual(created.writes, ["chat.create"]);
}

async function main() {
  await sendingToSomeoneElsesOrAMissingChatIsNotASessionError();
  await sendingWithoutASessionIsStillUnauthenticated();
  await otherChatMutationsReportNotFoundWithoutWriting();
  await deletingSomeoneElsesMessageDoesNotSignTheUserOut();
  await creatingAChatForAnotherUserIsForbiddenNotUnauthenticated();
  await theOwnerStillWorks();
  console.log("chatOwnershipErrors tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
