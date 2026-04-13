import assert from "node:assert/strict";
import { getTaskArchiveCutoff, isTerminalTaskStatus, isValidTaskTransition } from "../src/services/taskLifecycle";
import { TaskService } from "../src/services/taskService";

async function main() {
  assert.equal(isValidTaskTransition("queued", "processing"), true);
  assert.equal(isValidTaskTransition("processing", "completed"), true);
  assert.equal(isValidTaskTransition("completed", "processing"), false);
  assert.equal(isValidTaskTransition("failed", "completed"), false);
  assert.equal(isTerminalTaskStatus("completed"), true);
  assert.equal(isTerminalTaskStatus("processing"), false);

  const now = new Date("2026-04-13T12:00:00.000Z");
  const cutoff = getTaskArchiveCutoff(30, now);
  assert.equal(cutoff.toISOString(), "2026-03-14T12:00:00.000Z");

  const taskRecord = {
    id: "task_1",
    userId: "user_1",
    feature: "image_generation",
    status: "completed",
    progress: 100,
    metadata: null,
    resultReference: "img_123",
    errorMessage: null,
    startedAt: now,
    completedAt: now,
    failedAt: null,
    canceledAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const prismaMock = {
    task: {
      findFirst: async () => taskRecord,
      update: async () => {
        throw new Error("update should not be called for idempotent terminal updates");
      },
    },
  } as any;

  const taskService = new TaskService(prismaMock);
  const result = await taskService.completeTask("task_1", "user_1", { resultReference: "img_999" });

  assert.equal(result.id, "task_1");
  assert.equal(result.status, "completed");
  assert.equal(result.resultReference, "img_123");

  console.log("taskLifecycle checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});