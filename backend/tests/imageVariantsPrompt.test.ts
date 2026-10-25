import "./support/testEnvironment";
import assert from "node:assert/strict";
import { resolvers } from "../src/resolvers";

// generateAIImageVariants is paid and slow; an over-long prompt must be refused before any task is
// created or any allowance is spent (the single-image mutation already enforces the same limit).

function context() {
  const created: string[] = [];
  return {
    created,
    context: {
      user: { userId: "me_1", email: "me@example.test", role: "USER" },
      taskService: {
        createTask: async () => (created.push("task"), { id: "t1" }),
        failTask: async () => undefined,
      },
      huggingFaceService: { generateImages: async () => (created.push("provider"), { success: true, images: [] }) },
    } as any,
  };
}

async function anOverlongPromptIsRefusedBeforeAnythingIsSpent() {
  const { created, context: ctx } = context();
  const result = await (resolvers as any).Mutation.generateAIImageVariants(undefined, { prompt: "x".repeat(501) }, ctx);
  assert.equal(result.success, false);
  assert.match(String(result.error), /500/);
  assert.deepEqual(created, [], "no task and no provider call");
}

async function anEmptyPromptIsRefusedToo() {
  const { created, context: ctx } = context();
  const result = await (resolvers as any).Mutation.generateAIImageVariants(undefined, { prompt: "   " }, ctx);
  assert.equal(result.success, false);
  assert.deepEqual(created, []);
}

async function main() {
  await anOverlongPromptIsRefusedBeforeAnythingIsSpent();
  await anEmptyPromptIsRefusedToo();
  console.log("imageVariantsPrompt tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
