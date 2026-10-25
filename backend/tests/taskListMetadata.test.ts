import "./support/testEnvironment";
import assert from "node:assert/strict";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";

// Image tasks keep the generated images (base64, megabytes) in their metadata so a finished
// result can be restored. The task LIST is polled every few seconds by the apps and must not
// carry them; only the single-task query, used to restore one result, returns them.

const schema = makeExecutableSchema({ typeDefs, resolvers });
const caller = { userId: "me_1", email: "me@example.test", role: "USER" };

const HUGE_IMAGE = "data:image/jpeg;base64," + "A".repeat(200_000);

function aTask(id: string, metadata: string | null) {
  const now = new Date("2026-10-25T10:00:00.000Z");
  return {
    id,
    userId: "me_1",
    feature: "image_generation",
    status: "completed",
    progress: 100,
    metadata,
    resultReference: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: now,
    failedAt: null,
    canceledAt: null,
    archivedAt: null,
  };
}

const imageMetadata = JSON.stringify({ prompt: "a red fox", images: [HUGE_IMAGE, HUGE_IMAGE, HUGE_IMAGE, HUGE_IMAGE] });
const chatMetadata = JSON.stringify({ chatId: "chat_1", hasAttachment: false });

const tasks = [aTask("t_image", imageMetadata), aTask("t_chat", chatMetadata), aTask("t_none", null), aTask("t_broken", "{not json")];

const context: any = {
  user: caller,
  taskService: {
    getRecentTasksByUser: async () => tasks,
    getTaskByIdForUser: async (id: string) => tasks.find((task) => task.id === id) ?? null,
  },
};

async function run(source: string) {
  const result: any = await graphql({ schema, source, contextValue: context });
  assert.equal(result.errors, undefined, JSON.stringify(result.errors?.[0]?.message));
  return result.data;
}

async function theListDropsGeneratedImagesButKeepsTheRest() {
  const { myTasks } = await run(`{ myTasks(limit: 12) { id metadata } }`);
  const byId = Object.fromEntries(myTasks.map((task: any) => [task.id, task.metadata]));

  const image = JSON.parse(byId.t_image);
  assert.equal(image.prompt, "a red fox", "the prompt stays");
  assert.equal("images" in image, false, "the images are not in the list");
  assert.ok(byId.t_image.length < 500, "the listed metadata is small");

  assert.deepEqual(JSON.parse(byId.t_chat), { chatId: "chat_1", hasAttachment: false }, "other metadata is untouched");
  assert.equal(byId.t_none, null);
  assert.equal(byId.t_broken, "{not json", "metadata that is not JSON is passed through, not guessed at");
}

async function theSingleTaskStillReturnsTheImagesForRestore() {
  const { task } = await run(`{ task(id: "t_image") { metadata } }`);
  assert.equal(JSON.parse(task.metadata).images.length, 4);
}

async function main() {
  await theListDropsGeneratedImagesButKeepsTheRest();
  await theSingleTaskStillReturnsTheImagesForRestore();
  console.log("taskListMetadata tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
