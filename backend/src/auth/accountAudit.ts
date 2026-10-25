import { AppContext } from "../resolvers/types/context";
import { logger } from "../utils/logger";

export type AccountEvent =
  | "PASSWORD_CHANGED"
  | "PROFILE_UPDATED"
  | "EMAIL_CHANGED"
  | "PREFERENCES_UPDATED";

// The change is already saved when this runs, so a broken audit store is logged loudly but does not
// turn a successful change into a failure. Details must never hold a password, hash or the new
// values of personal fields; list the field names that changed instead.
export async function recordAccountEvent(
  context: AppContext,
  account: { id: string; email: string },
  event: AccountEvent,
  details: object,
): Promise<void> {
  try {
    await context.prisma.securityAuditLog.create({
      data: {
        userId: account.id,
        userEmail: account.email,
        event,
        ipAddress: context.req?.ip,
        userAgent: context.req?.headers?.["user-agent"],
        details: JSON.stringify(details),
      },
    });
  } catch (error: any) {
    logger.error(`[audit] could not record ${event}`, {
      userId: account.id,
      message: error.message,
    });
  }
}
