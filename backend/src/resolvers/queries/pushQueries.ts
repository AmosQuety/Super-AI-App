import { AuthenticationError, ForbiddenError } from "apollo-server-express";
import { AppContext } from "../types/context";

export const pushQueries = {
  pushNotificationConfig: (_: any, __: any, context: AppContext) => {
    return context.pushNotificationService.getConfig();
  },

  myPushSubscriptions: async (_: any, __: any, context: AppContext) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to view push subscriptions");
    }

    return context.pushNotificationService.listSubscriptions(context.user.userId);
  },

  pushDeliveryMetrics: async (
    _: any,
    { windowMinutes = 60 }: { windowMinutes?: number },
    context: AppContext,
  ) => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to view push delivery metrics");
    }

    if (context.user.role !== "ADMIN") {
      throw new ForbiddenError("Admin role required for operational metrics");
    }

    return context.pushNotificationService.getDeliveryMetrics(windowMinutes);
  },
};