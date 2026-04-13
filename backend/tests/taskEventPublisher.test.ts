import assert from "node:assert/strict";
import { TaskEventPublisher } from "../src/services/taskEventPublisher";

async function main() {
  let createCalls = 0;
  const prismaMock = {
    taskEvent: {
      create: async (_args: any) => {
        createCalls += 1;
        if (createCalls > 1) {
          const error: any = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }

        return {
          id: "evt_1",
        };
      },
    },
  } as any;

  const publisher = new TaskEventPublisher(prismaMock);

  const firstResult = await publisher.publishEvent({
    taskId: "task_1",
    userId: "user_1",
    feature: "chat_response",
    eventType: "task.completed",
    status: "completed",
    progress: 100,
    resultReference: "msg_1",
  });

  const secondResult = await publisher.publishEvent({
    taskId: "task_1",
    userId: "user_1",
    feature: "chat_response",
    eventType: "task.completed",
    status: "completed",
    progress: 100,
    resultReference: "msg_1",
  });

  assert.equal(firstResult.published, true);
  assert.equal(secondResult.published, false);
  assert.equal(secondResult.deduplicated, true);
  assert.equal(firstResult.idempotencyKey, "task_1:task.completed");
  assert.equal(secondResult.idempotencyKey, "task_1:task.completed");

  console.log("taskEventPublisher checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});