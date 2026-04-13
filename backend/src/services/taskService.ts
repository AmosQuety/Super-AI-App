import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import {
  clampProgress,
  getTaskArchiveCutoff,
  isTerminalTaskStatus,
  isValidTaskTransition,
  mergeTaskMetadata,
  sanitizeTaskErrorMessage,
  serializeTaskMetadata,
  TaskStatus,
} from "./taskLifecycle";
import { TaskEventPublisher } from "./taskEventPublisher";

export interface CreateTaskInput {
  userId: string;
  feature: string;
  status?: TaskStatus;
  progress?: number;
  metadata?: Record<string, unknown> | null;
  resultReference?: string | null;
  idempotencyKey?: string | null;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  progress?: number;
  metadata?: Record<string, unknown> | null;
  resultReference?: string | null;
  errorMessage?: string | null;
}

export interface TaskQueryOptions {
  limit?: number;
  includeArchived?: boolean;
}

export class TaskService {
  private readonly taskEventPublisher: TaskEventPublisher;

  constructor(private readonly prisma: PrismaClient) {
    this.taskEventPublisher = new TaskEventPublisher(prisma);
  }

  async createTask(input: CreateTaskInput) {
    const now = new Date();
    const status = input.status ?? "queued";

    return this.prisma.task.create({
      data: {
        userId: input.userId,
        feature: input.feature,
        status,
        progress: input.progress ? clampProgress(input.progress) : 0,
        metadata: serializeTaskMetadata(input.metadata),
        resultReference: input.resultReference ?? null,
        startedAt: status === "processing" ? now : null,
        completedAt: status === "completed" ? now : null,
        failedAt: status === "failed" ? now : null,
        canceledAt: status === "canceled" ? now : null,
      },
    });
  }

  async markProcessing(taskId: string, userId: string, metadata?: Record<string, unknown> | null) {
    return this.transitionTask(taskId, userId, { status: "processing", metadata });
  }

  async updateProgress(
    taskId: string,
    userId: string,
    progress: number,
    metadata?: Record<string, unknown> | null,
  ) {
    const task = await this.getTaskByIdForUser(taskId, userId);
    if (!task) {
      throw new Error("Task not found");
    }

    const nextStatus = (task.status === "queued" ? "processing" : task.status) as TaskStatus;
    return this.transitionTask(taskId, userId, { status: nextStatus, progress, metadata });
  }

  async completeTask(
    taskId: string,
    userId: string,
    options: { resultReference?: string | null; metadata?: Record<string, unknown> | null } = {},
  ) {
    return this.transitionTask(taskId, userId, {
      status: "completed",
      progress: 100,
      resultReference: options.resultReference,
      metadata: options.metadata,
    });
  }

  async failTask(
    taskId: string,
    userId: string,
    errorMessage: string,
    options: { metadata?: Record<string, unknown> | null } = {},
  ) {
    return this.transitionTask(taskId, userId, {
      status: "failed",
      errorMessage,
      metadata: options.metadata,
    });
  }

  async cancelTask(
    taskId: string,
    userId: string,
    options: { metadata?: Record<string, unknown> | null; resultReference?: string | null } = {},
  ) {
    return this.transitionTask(taskId, userId, {
      status: "canceled",
      metadata: options.metadata,
      resultReference: options.resultReference,
    });
  }

  async transitionTask(taskId: string, userId: string, input: UpdateTaskInput) {
    const existingTask = await this.getTaskByIdForUser(taskId, userId);

    if (!existingTask) {
      throw new Error("Task not found");
    }

    const nextStatus = input.status ?? existingTask.status;
    if (!isValidTaskTransition(existingTask.status, nextStatus)) {
      throw new Error(`Invalid task transition from ${existingTask.status} to ${nextStatus}`);
    }

    if (existingTask.status === nextStatus && isTerminalTaskStatus(nextStatus)) {
      return existingTask;
    }

    const now = new Date();
    const nextProgress = input.progress === undefined
      ? existingTask.progress
      : Math.max(existingTask.progress ?? 0, clampProgress(input.progress));

    const shouldPublishStartedEvent =
      existingTask.status !== "processing" && nextStatus === "processing";
    const shouldPublishProgressEvent =
      nextProgress > (existingTask.progress ?? 0);
    const shouldPublishCompletedEvent =
      existingTask.status !== "completed" && nextStatus === "completed";
    const shouldPublishFailedEvent =
      existingTask.status !== "failed" && nextStatus === "failed";

    const nextMetadata = input.metadata === undefined
      ? existingTask.metadata ?? undefined
      : mergeTaskMetadata(existingTask.metadata, input.metadata);

    const data: Record<string, unknown> = {
      status: nextStatus,
      progress: nextProgress,
      metadata: nextMetadata ?? null,
      resultReference: input.resultReference === undefined ? existingTask.resultReference : input.resultReference,
      errorMessage: input.errorMessage === undefined
        ? existingTask.errorMessage
        : sanitizeTaskErrorMessage(input.errorMessage),
    };

    if (nextStatus === "processing" && !existingTask.startedAt) {
      data.startedAt = now;
    }

    if (nextStatus === "completed") {
      data.completedAt = now;
      data.progress = 100;
      data.failedAt = null;
      data.canceledAt = null;
      data.errorMessage = null;
    }

    if (nextStatus === "failed") {
      data.failedAt = now;
      data.completedAt = null;
      data.canceledAt = null;
    }

    if (nextStatus === "canceled") {
      data.canceledAt = now;
      data.completedAt = null;
      data.failedAt = null;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data,
    });

    if (shouldPublishStartedEvent) {
      await this.taskEventPublisher.publishEvent({
        taskId: updatedTask.id,
        userId: updatedTask.userId,
        feature: updatedTask.feature,
        eventType: "task.started",
        status: updatedTask.status,
        progress: updatedTask.progress,
      });
    }

    if (shouldPublishProgressEvent) {
      await this.taskEventPublisher.publishEvent({
        taskId: updatedTask.id,
        userId: updatedTask.userId,
        feature: updatedTask.feature,
        eventType: "task.progress",
        status: updatedTask.status,
        progress: updatedTask.progress,
      });
    }

    if (shouldPublishCompletedEvent) {
      await this.taskEventPublisher.publishEvent({
        taskId: updatedTask.id,
        userId: updatedTask.userId,
        feature: updatedTask.feature,
        eventType: "task.completed",
        status: updatedTask.status,
        progress: updatedTask.progress,
        resultReference: String(updatedTask.resultReference ?? ""),
      });
    }

    if (shouldPublishFailedEvent) {
      await this.taskEventPublisher.publishEvent({
        taskId: updatedTask.id,
        userId: updatedTask.userId,
        feature: updatedTask.feature,
        eventType: "task.failed",
        status: updatedTask.status,
        progress: updatedTask.progress,
        errorMessage: String(updatedTask.errorMessage ?? "Task failed"),
      });
    }

    return updatedTask;
  }

  async getTaskByIdForUser(taskId: string, userId: string) {
    return this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
  }

  async getTaskByResultReferenceForUser(userId: string, resultReference: string) {
    return this.prisma.task.findFirst({
      where: { userId, resultReference },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getRecentTasksByUser(userId: string, options: TaskQueryOptions = {}) {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    await this.archiveOldTasks();

    return this.prisma.task.findMany({
      where: {
        userId,
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });
  }

  async archiveOldTasks(retentionDays = Number(process.env.TASK_RETENTION_DAYS ?? 30)) {
    const cutoff = getTaskArchiveCutoff(retentionDays);
    const result = await this.prisma.task.updateMany({
      where: {
        archivedAt: null,
        status: { in: ["completed", "failed", "canceled"] },
        updatedAt: { lt: cutoff },
      },
      data: {
        archivedAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info("[tasks] archived old tasks", {
        archivedCount: result.count,
        retentionDays,
      });
    }

    return result;
  }
}