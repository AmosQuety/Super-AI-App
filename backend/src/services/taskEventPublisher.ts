import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { sanitizeTaskErrorMessage, serializeTaskMetadata } from "./taskLifecycle";
import { PushNotificationService } from "./pushNotificationService";
import { OpsAlertingService } from "./opsAlertingService";

export const TASK_EVENT_TYPES = ["task.started", "task.progress", "task.completed", "task.failed"] as const;
export type TaskEventType = typeof TASK_EVENT_TYPES[number];

export interface PublishTaskEventInput {
  taskId: string;
  userId: string;
  feature: string;
  eventType: TaskEventType;
  status: string;
  progress?: number | null;
  resultReference?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PublishTaskEventResult {
  published: boolean;
  deduplicated?: boolean;
  idempotencyKey: string;
}

export class TaskEventPublisher {
  private readonly pushNotificationService: PushNotificationService;
  private readonly opsAlertingService: OpsAlertingService;

  constructor(private readonly prisma: PrismaClient) {
    this.pushNotificationService = new PushNotificationService(prisma);
    this.opsAlertingService = new OpsAlertingService(prisma);
  }

  async publishEvent(input: PublishTaskEventInput): Promise<PublishTaskEventResult> {
    const idempotencyKey = this.buildIdempotencyKey(input);

    try {
      await this.prisma.taskEvent.create({
        data: {
          taskId: input.taskId,
          userId: input.userId,
          feature: input.feature,
          eventType: input.eventType,
          status: input.status,
          progress: input.progress ?? null,
          resultReference: input.resultReference ?? null,
          errorMessage: sanitizeTaskErrorMessage(input.errorMessage),
          metadata: serializeTaskMetadata(input.metadata),
          idempotencyKey,
        },
      });

      logger.info("[task-events] published", {
        taskId: input.taskId,
        eventType: input.eventType,
        status: input.status,
        progress: input.progress ?? null,
        idempotencyKey,
      });

      if (input.eventType === "task.completed" || input.eventType === "task.failed") {
        this.pushNotificationService.notifyTaskEvent({
          taskId: input.taskId,
          userId: input.userId,
          feature: input.feature,
          status: input.status,
          progress: input.progress ?? null,
          resultReference: input.resultReference ?? null,
          errorMessage: input.errorMessage ?? null,
        }).catch((error) => {
          logger.warn("[push] notification fanout failed", {
            taskId: input.taskId,
            eventType: input.eventType,
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }

      if (input.eventType === "task.failed") {
        this.opsAlertingService.checkTaskFailureSpike().catch((error) => {
          logger.warn("[ops-alert] task failure spike check failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }

      return { published: true, idempotencyKey };
    } catch (error: any) {
      if (error?.code === "P2002") {
        logger.debug("[task-events] deduplicated", {
          taskId: input.taskId,
          eventType: input.eventType,
          idempotencyKey,
        });

        return {
          published: false,
          deduplicated: true,
          idempotencyKey,
        };
      }

      logger.error("[task-events] publish failed", {
        taskId: input.taskId,
        eventType: input.eventType,
        idempotencyKey,
        message: error?.message || String(error),
      });

      throw error;
    }
  }

  private buildIdempotencyKey(input: PublishTaskEventInput): string {
    switch (input.eventType) {
      case "task.started":
        return `${input.taskId}:task.started`;
      case "task.progress":
        return `${input.taskId}:task.progress:${input.progress ?? -1}`;
      case "task.completed":
      case "task.failed":
        return `${input.taskId}:${input.eventType}`;
      default:
        return `${input.taskId}:${input.eventType}`;
    }
  }
}