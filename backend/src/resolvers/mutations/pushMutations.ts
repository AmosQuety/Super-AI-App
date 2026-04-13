import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";

export const pushMutations = {
  registerPushSubscription: async (
    _: any,
    { input }: { input: { endpoint: string; p256dh: string; auth: string; deviceLabel?: string | null; userAgent?: string | null } },
    context: AppContext,
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to register push notifications");
    }

    return context.pushNotificationService.registerSubscription(context.user.userId, input);
  },

  unregisterPushSubscription: async (
    _: any,
    { endpoint }: { endpoint: string },
    context: AppContext,
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to unregister push notifications");
    }

    const subscription = await context.pushNotificationService.unregisterSubscription(context.user.userId, endpoint);
    return Boolean(subscription);
  },

  trackPushEngagement: async (
    _: any,
    {
      taskId,
      eventType,
      metadata,
    }: { taskId: string; eventType: "CLICKED" | "OPENED_APP"; metadata?: string | null },
    context: AppContext,
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to record push engagement");
    }

    const normalized = eventType === "CLICKED" ? "clicked" : "opened_app";
    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata) {
      try {
        const parsed = JSON.parse(metadata);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedMetadata = parsed as Record<string, unknown>;
        }
      } catch {
        parsedMetadata = { raw: metadata.slice(0, 500) };
      }
    }

    await context.pushNotificationService.recordEngagementEvent(
      context.user.userId,
      taskId,
      normalized,
      parsedMetadata,
    );

    return true;
  },
};