import { AppContext } from "../resolvers/types/context";
import { logger } from "../utils/logger";

export type AccountEvent =
  | "PASSWORD_CHANGED"
  | "PASSWORD_CHECK_FAILED"
  | "PASSWORD_CHECK_LOCKED"
  | "LOGIN_REFUSED_DISABLED"
  | "FACE_LOGIN_LOCKED"
  | "OTHER_SESSIONS_ENDED"
  | "PROFILE_UPDATED"
  | "EMAIL_CHANGED"
  | "PREFERENCES_UPDATED";

// A broken audit store is logged loudly but never turns a change that is already saved into a
// failure. A null account records an event with no known user (for example a sign-in for an email
// that has no account); nothing the caller typed may be stored for it. Details must never hold a password, hash or the new values of personal fields; list the
// field names that changed instead.
export async function recordAccountEvent(
  context: AppContext,
  account: { id: string; email: string } | null,
  event: AccountEvent,
  details: object,
): Promise<void> {
  try {
    await context.prisma.securityAuditLog.create({
      data: {
        userId: account?.id ?? null,
        userEmail: account?.email ?? null,
        event,
        ipAddress: context.req?.ip,
        userAgent: context.req?.headers?.["user-agent"],
        details: JSON.stringify(details),
      },
    });
  } catch (error: any) {
    logger.error(`[audit] could not record ${event}`, {
      userId: account?.id,
      message: error.message,
    });
  }
}
