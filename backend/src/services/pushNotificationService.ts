import webpush from "web-push";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { createHash } from "node:crypto";
import { OpsAlertingService } from "./opsAlertingService";
import { featureFlags, isPushEnabledForUser } from "../config/featureFlags";

export interface RegisterPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel?: string | null;
  userAgent?: string | null;
}

export interface PushNotificationConfig {
  enabled: boolean;
  publicKey: string | null;
  serviceWorkerUrl: string;
  rolloutPercent: number;
  reason: string | null;
}

interface PushPayloadOptions {
  taskId: string;
  userId?: string;
  feature: string;
  status: string;
  progress?: number | null;
  resultReference?: string | null;
  errorMessage?: string | null;
}

interface BrowserPushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  isActive: boolean;
}

const FEATURE_ROUTE_MAP: Record<string, string> = {
  chat_response: "/chat",
  image_generation: "/image",
  voice_processing: "/voice",
  voice_clone: "/voice",
  voice_registration: "/voice",
  document_ingestion: "/chat",
};

const FEATURE_LABEL_MAP: Record<string, string> = {
  chat_response: "Chat",
  image_generation: "Image generation",
  voice_processing: "Voice task",
  voice_clone: "Voice cloning",
  voice_registration: "Voice registration",
  document_ingestion: "Document ingestion",
};

export class PushNotificationService {
  private readonly enabled: boolean;
  private readonly publicKey: string | null;
  private readonly maxSendAttempts: number;
  private readonly initialBackoffMs: number;
  private readonly opsAlertingService: OpsAlertingService;

  constructor(private readonly prisma: PrismaClient) {
    this.publicKey = process.env.VAPID_PUBLIC_KEY ?? null;
    this.enabled = Boolean(this.publicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
    this.maxSendAttempts = Math.max(1, Number(process.env.PUSH_MAX_SEND_ATTEMPTS ?? 3));
    this.initialBackoffMs = Math.max(100, Number(process.env.PUSH_INITIAL_BACKOFF_MS ?? 300));
    this.opsAlertingService = new OpsAlertingService(prisma);

    if (this.enabled) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT as string,
        this.publicKey as string,
        process.env.VAPID_PRIVATE_KEY as string,
      );
    } else {
      logger.warn("[push] VAPID not configured; browser push is disabled");
    }
  }

  getConfig(): PushNotificationConfig {
    const reason = !featureFlags.pushEnabled
      ? "Push feature flag is disabled"
      : !this.enabled
      ? "VAPID keys are not configured"
      : null;

    return {
      enabled: featureFlags.pushEnabled && this.enabled,
      publicKey: this.publicKey,
      serviceWorkerUrl: "/sw.js",
      rolloutPercent: featureFlags.pushRolloutPercent,
      reason,
    };
  }

  async listSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async registerSubscription(userId: string, input: RegisterPushSubscriptionInput) {
    if (!this.enabled || !featureFlags.pushEnabled) {
      throw new Error("Browser push is not configured on the server");
    }

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        deviceLabel: input.deviceLabel ?? null,
        userAgent: input.userAgent ?? null,
        isActive: true,
      },
      update: {
        userId,
        p256dh: input.p256dh,
        auth: input.auth,
        deviceLabel: input.deviceLabel ?? null,
        userAgent: input.userAgent ?? null,
        isActive: true,
        lastFailureAt: null,
        lastFailureReason: null,
      },
    });
  }

  async unregisterSubscription(userId: string, endpoint: string) {
    const subscription = await this.prisma.pushSubscription.findFirst({
      where: { userId, endpoint },
    });

    if (!subscription) {
      return null;
    }

    return this.prisma.pushSubscription.update({
      where: { id: subscription.id },
      data: {
        isActive: false,
        lastFailureAt: new Date(),
        lastFailureReason: "User unsubscribed",
      },
    });
  }

  async notifyTaskEvent(input: PushPayloadOptions) {
    if (!this.enabled || !featureFlags.pushEnabled) {
      return { sent: 0, cleanedUp: 0 };
    }

    if (input.status !== "completed" && input.status !== "failed") {
      return { sent: 0, cleanedUp: 0 };
    }

    const task = await this.prisma.task.findUnique({
      where: { id: input.taskId },
      select: { userId: true },
    });

    if (!task) {
      return { sent: 0, failed: 0, transientFailed: 0, cleanedUp: 0 };
    }

    const userId = input.userId ?? task.userId;

    if (!isPushEnabledForUser(userId)) {
      return { sent: 0, failed: 0, transientFailed: 0, cleanedUp: 0 };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: task.userId, isActive: true },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, transientFailed: 0, cleanedUp: 0 };
    }

    const payload = this.buildTaskPayload(input);
    let sent = 0;
    let cleanedUp = 0;
    let failed = 0;
    let transientFailed = 0;

    for (const subscription of subscriptions) {
      const result = await this.sendWithRetry(subscription, payload, userId);

      if (result.success) {
        sent += 1;

        await this.prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSuccessAt: new Date(),
            lastFailureAt: null,
            lastFailureReason: null,
          },
        });
        await this.recordDeliveryEvent({
          userId: result.userId,
          taskId: input.taskId,
          subscriptionId: subscription.id,
          endpoint: subscription.endpoint,
          eventType: "sent",
          deliveryClass: result.deliveryClass,
          providerStatusCode: result.statusCode,
          attemptCount: result.attemptCount,
        });
        continue;
      }

      failed += 1;
      if (result.deliveryClass === "transient") {
        transientFailed += 1;
      }

      const failureReason = result.failureReason || "Unknown push failure";

      logger.warn("[push] notification delivery failed", {
        taskId: input.taskId,
        endpoint: subscription.endpoint,
        statusCode: result.statusCode,
        failureReason,
        attemptCount: result.attemptCount,
      });

      await this.recordDeliveryEvent({
        userId: result.userId,
        taskId: input.taskId,
        subscriptionId: subscription.id,
        endpoint: subscription.endpoint,
        eventType: "failed",
        deliveryClass: result.deliveryClass,
        providerStatusCode: result.statusCode,
        attemptCount: result.attemptCount,
        metadata: {
          failureReason,
        },
      });

      if (result.deliveryClass === "permanent") {
        if (result.statusCode === 404 || result.statusCode === 410) {
          cleanedUp += 1;
          await this.prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              isActive: false,
              lastFailureAt: new Date(),
              lastFailureReason: failureReason,
            },
          });
          continue;
        }
      }

      await this.prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: {
          lastFailureAt: new Date(),
          lastFailureReason: failureReason,
        },
      });
    }

    if (failed > 0) {
      await this.opsAlertingService.checkPushFailureSpike();
    }

    return { sent, failed, transientFailed, cleanedUp };
  }

  async recordEngagementEvent(
    userId: string,
    taskId: string | null,
    eventType: "clicked" | "opened_app",
    metadata?: Record<string, unknown>,
  ) {
    return this.recordDeliveryEvent({
      userId,
      taskId: taskId ?? undefined,
      eventType,
      deliveryClass: "engagement",
      attemptCount: 1,
      metadata,
    });
  }

  async getDeliveryMetrics(windowMinutes = 60) {
    const minutes = Math.max(1, Math.min(24 * 60, Math.floor(windowMinutes)));
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const prismaAny = this.prisma as any;
    const events: Array<{ eventType: string; deliveryClass: string | null }> = await prismaAny.pushDeliveryEvent.findMany({
      where: {
        createdAt: { gte: cutoff },
      },
      select: {
        eventType: true,
        deliveryClass: true,
      },
    });

    const sent = events.filter((event: { eventType: string; deliveryClass: string | null }) => event.eventType === "sent").length;
    const failed = events.filter((event: { eventType: string; deliveryClass: string | null }) => event.eventType === "failed").length;
    const clicked = events.filter((event: { eventType: string; deliveryClass: string | null }) => event.eventType === "clicked").length;
    const openedApp = events.filter((event: { eventType: string; deliveryClass: string | null }) => event.eventType === "opened_app").length;
    const transientFailures = events.filter((event: { eventType: string; deliveryClass: string | null }) => event.eventType === "failed" && event.deliveryClass === "transient").length;
    const permanentFailures = events.filter((event: { eventType: string; deliveryClass: string | null }) => event.eventType === "failed" && event.deliveryClass === "permanent").length;
    const attempts = sent + failed;
    const failureRate = attempts > 0 ? failed / attempts : 0;

    return {
      windowMinutes: minutes,
      sent,
      failed,
      clicked,
      openedApp,
      transientFailures,
      permanentFailures,
      failureRate,
    };
  }

  private toWebPushSubscription(subscription: BrowserPushSubscriptionRecord) {
    return {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };
  }

  private buildTaskPayload(input: PushPayloadOptions) {
    const route = FEATURE_ROUTE_MAP[input.feature] ?? "/chat";
    const label = FEATURE_LABEL_MAP[input.feature] ?? "Task";
    const statusText = input.status === "completed" ? "is ready" : "needs attention";

    return JSON.stringify({
      title: `${label} ${statusText}`,
      body: input.status === "completed"
        ? "Your results are ready. Open Xemora to continue."
        : "The task failed. Open Xemora to review details.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: `task:${input.taskId}`,
      renotify: true,
      data: {
        url: `${route}?taskId=${encodeURIComponent(input.taskId)}&pushTaskId=${encodeURIComponent(input.taskId)}`,
        taskId: input.taskId,
        feature: input.feature,
        status: input.status,
        progress: input.progress ?? null,
      },
    });
  }

  private classifyFailure(statusCode: number | null): "transient" | "permanent" {
    if (statusCode === null) {
      return "transient";
    }

    if ([408, 425, 429, 500, 502, 503, 504].includes(statusCode)) {
      return "transient";
    }

    return "permanent";
  }

  private async sendWithRetry(subscription: BrowserPushSubscriptionRecord, payload: string, userId: string) {
    let attemptCount = 0;
    let lastStatusCode: number | null = null;
    let lastFailureReason: string | null = null;
    let deliveryClass: "transient" | "permanent" = "transient";

    while (attemptCount < this.maxSendAttempts) {
      attemptCount += 1;
      try {
        await webpush.sendNotification(this.toWebPushSubscription(subscription), payload);
        return {
          success: true as const,
          userId,
          statusCode: lastStatusCode,
          deliveryClass: "success",
          attemptCount,
          failureReason: null,
        };
      } catch (error: any) {
        lastStatusCode = error?.statusCode ?? error?.status ?? null;
        lastFailureReason = error?.body || error?.message || String(error);
        deliveryClass = this.classifyFailure(lastStatusCode);

        if (deliveryClass === "permanent") {
          break;
        }

        if (attemptCount >= this.maxSendAttempts) {
          break;
        }

        const backoffMs = this.initialBackoffMs * 2 ** (attemptCount - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    return {
      success: false as const,
      userId,
      statusCode: lastStatusCode,
      deliveryClass,
      attemptCount,
      failureReason: lastFailureReason,
    };
  }

  private async recordDeliveryEvent(input: {
    userId: string;
    taskId?: string;
    subscriptionId?: string;
    endpoint?: string;
    eventType: "sent" | "failed" | "clicked" | "opened_app";
    deliveryClass?: string;
    providerStatusCode?: number | null;
    attemptCount?: number;
    metadata?: Record<string, unknown>;
  }) {
    const endpointHash = input.endpoint
      ? createHash("sha256").update(input.endpoint).digest("hex").slice(0, 16)
      : null;

    const prismaAny = this.prisma as any;
    return prismaAny.pushDeliveryEvent.create({
      data: {
        userId: input.userId,
        taskId: input.taskId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        endpointHash,
        eventType: input.eventType,
        deliveryClass: input.deliveryClass ?? null,
        providerStatusCode: input.providerStatusCode ?? null,
        attemptCount: input.attemptCount ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 4000) : null,
      },
    });
  }
}