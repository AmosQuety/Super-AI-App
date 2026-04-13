# Phase 1 Task Status Foundation

## What Changed

- Added a persistent `Task` model in PostgreSQL via Prisma.
- Added user-owned task queries for recent and by-id lookup.
- Added a reusable backend task lifecycle service for create, progress, terminal completion, failure, cancel, and archival.
- Wired task tracking into major async backend flows:
  - chat responses
  - document ingestion
  - image generation
  - voice registration and voice job polling
  - voice processing utilities

## New Env Var

- `TASK_RETENTION_DAYS` (default: `30`)
  - Controls when terminal tasks become eligible for soft archival.

## Migration Steps

1. Apply the Prisma migration:

   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. Regenerate the Prisma client:

   ```bash
   cd backend
   npx prisma generate
   ```

3. If you are developing locally and need a fresh database state, use the existing Prisma workflow already used by the repo:

   ```bash
   cd backend
   npx prisma migrate dev
   ```

## Retention Policy

- Tasks are soft-archived by setting `archivedAt`.
- Recent task queries exclude archived tasks by default.
- The archival entry point is `TaskService.archiveOldTasks()` and can be scheduled later if desired.

## Local Test

- Run the lifecycle unit test:

  ```bash
  cd backend
  npm run test:tasks
  ```
