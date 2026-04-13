CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "resultReference" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasks_user_updated_idx" ON "tasks"("userId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "tasks_user_status_updated_idx" ON "tasks"("userId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "tasks_user_archived_updated_idx" ON "tasks"("userId", "archivedAt", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "tasks_feature_status_idx" ON "tasks"("feature", "status");