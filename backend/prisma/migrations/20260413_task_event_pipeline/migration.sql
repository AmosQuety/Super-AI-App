CREATE TABLE IF NOT EXISTS "task_events" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "progress" INTEGER,
  "resultReference" TEXT,
  "errorMessage" TEXT,
  "metadata" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "task_events"
  ADD CONSTRAINT "task_events_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "task_events_idempotency_key_idx" ON "task_events"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "task_events_task_created_idx" ON "task_events"("taskId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "task_events_user_created_idx" ON "task_events"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "task_events_type_created_idx" ON "task_events"("eventType", "createdAt" DESC);