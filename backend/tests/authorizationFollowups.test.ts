import assert from "node:assert/strict";
import axios from "axios";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { VoiceCloningService } from "../src/services/voiceCloningService";

type Caller = { userId: string; email: string; role?: string } | null;

const owner: Caller = { userId: "owner_1", email: "owner@example.test", role: "USER" };
const otherUser: Caller = { userId: "other_2", email: "other@example.test", role: "USER" };
const admin: Caller = { userId: "admin_1", email: "admin@example.test", role: "ADMIN" };

// Keep the tests off the network: the biometric engine and the voice engine are stubbed.
(axios as any).get = async () => ({ status: 200, data: { system: "test-engine" } });
let voiceServiceCalls = 0;
VoiceCloningService.prototype.getJobStatus = async () => {
  voiceServiceCalls += 1;
  return { success: true, status: "PROCESSING" } as any;
};

function contextFor(user: Caller) {
  return {
    user,
    prisma: {
      imageGeneration: { findMany: async () => [{ id: "img_1" }] },
      user: { count: async () => 7 },
    },
    taskService: {
      getTaskByResultReferenceForUser: async (userId: string, jobId: string) =>
        userId === "owner_1" && jobId === "job_1" ? { id: "task_1" } : null,
      completeTask: async () => undefined,
      failTask: async () => undefined,
    },
  } as any;
}

async function run(source: string, user: Caller) {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  return graphql({ schema, source, contextValue: contextFor(user) }) as Promise<any>;
}

const code = (result: any) => result.errors?.[0]?.extensions?.code;

async function imagesAreLimitedToTheirOwner() {
  const query = '{ images(userId: "owner_1") { id } }';
  assert.equal(code(await run(query, null)), "UNAUTHENTICATED");
  assert.equal(code(await run(query, otherUser)), "FORBIDDEN");
  assert.equal((await run(query, owner)).errors, undefined);
  assert.equal((await run(query, admin)).errors, undefined);
}

async function voiceJobStatusIsLimitedToTheJobsOwner() {
  const query = '{ getVoiceJobStatus(jobId: "job_1") { status } }';
  assert.ok((await run(query, null)).errors, "anonymous callers must be rejected");

  const callsBefore = voiceServiceCalls;
  const forOther = await run(query, otherUser);
  assert.equal(forOther.errors?.[0]?.message, "Voice job not found");
  assert.equal(voiceServiceCalls, callsBefore, "the voice engine must not be called for a non-owner");

  const forOwner = await run(query, owner);
  assert.equal(forOwner.errors, undefined);
  assert.equal(forOwner.data.getVoiceJobStatus.status, "PROCESSING");

  assert.equal((await run(query, admin)).errors, undefined);
}

async function faceServiceCountIsAdminOnly() {
  const query = "{ faceServiceStatus { isOnline registeredFacesCount } }";
  for (const caller of [null, owner]) {
    const result = await run(query, caller);
    assert.equal(result.errors, undefined);
    assert.equal(result.data.faceServiceStatus.isOnline, true);
    assert.equal(result.data.faceServiceStatus.registeredFacesCount, 0);
  }
  const byAdmin = await run(query, admin);
  assert.equal(byAdmin.data.faceServiceStatus.registeredFacesCount, 7);
}

async function main() {
  await imagesAreLimitedToTheirOwner();
  await voiceJobStatusIsLimitedToTheJobsOwner();
  await faceServiceCountIsAdminOnly();
  console.log("authorizationFollowups tests passed");
}

// Importing the resolvers opens Redis and Prisma handles, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
