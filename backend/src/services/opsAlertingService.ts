import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const alertCooldownByKey: Record<string, number> = {};

function getCutoff(windowMinutes: number): Date {
  return new Date(Date.now() - windowMinutes * 60 * 1000);
}

function parseJsonSafe(value?: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export class OpsAlertingService {
  constructor(private readonly prisma: PrismaClient) {}

  async checkPushFailureSpike(): Promise<void> {
    const windowMinutes = Number(process.env.ALERT_WINDOW_MINUTES ?? 15);
    const threshold = Number(process.env.ALERT_PUSH_FAILURE_SPIKE_THRESHOLD ?? 20);
    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MS ?? 10 * 60 * 1000);
    const cutoff = getCutoff(windowMinutes);

    const prismaAny = this.prisma as any;
    const failures = await prismaAny.pushDeliveryEvent.count({
      where: {
        eventType: "failed",
        createdAt: { gte: cutoff },
      },
    });

    if (failures < threshold) {
      return;
    }

    await this.emitAlertWithCooldown("push-failure-spike", cooldownMs, {
      message: "Push failure spike detected",
      failures,
      windowMinutes,
      threshold,
    });
  }

  async checkTaskFailureSpike(): Promise<void> {
    const windowMinutes = Number(process.env.ALERT_WINDOW_MINUTES ?? 15);
    const threshold = Number(process.env.ALERT_TASK_FAILURE_SPIKE_THRESHOLD ?? 15);
    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MS ?? 10 * 60 * 1000);
    const cutoff = getCutoff(windowMinutes);

    const failures = await this.prisma.taskEvent.count({
      where: {
        eventType: "task.failed",
        createdAt: { gte: cutoff },
      },
    });

    if (failures < threshold) {
      return;
    }

    await this.emitAlertWithCooldown("task-failure-spike", cooldownMs, {
      message: "Task failure spike detected",
      failures,
      windowMinutes,
      threshold,
    });
  }

  private async emitAlertWithCooldown(alertKey: string, cooldownMs: number, payload: Record<string, unknown>) {
    const now = Date.now();
    const lastSentAt = alertCooldownByKey[alertKey] ?? 0;
    if (now - lastSentAt < cooldownMs) {
      return;
    }

    alertCooldownByKey[alertKey] = now;
    logger.error("[ops-alert] threshold exceeded", {
      alertKey,
      ...payload,
    });

    const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alertKey,
          timestamp: new Date().toISOString(),
          ...payload,
        }),
      });
    } catch (error) {
      logger.warn("[ops-alert] webhook dispatch failed", {
        alertKey,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static parseMetadata = parseJsonSafe;
}