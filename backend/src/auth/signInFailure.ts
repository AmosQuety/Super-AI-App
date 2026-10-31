import { AppContext } from "../resolvers/types/context";
import { countSecurityEvent } from "../utils/securityMetrics";
import { recordAccountEvent } from "./accountAudit";
import { recordWrongPassword } from "./currentPassword";
import { networkOf } from "./networkAddress";
import { reserveAttempt } from "./passwordAttempts";

// Wrong sign-ins for emails with no account are written to the audit trail so credential
// stuffing leaves evidence, but a run that rotates emails could write rows without limit. Each
// network gets this many rows per lockout window; the metric still counts every failure, so the
// volume stays visible after the rows stop.
export const MAX_UNKNOWN_EMAIL_AUDIT_ROWS = 20;

interface AttemptedAccount {
  id: string;
  email: string;
}

// One failed sign-in, counted and audited by what went wrong. The caller sees the same generic
// refusal in every case; only the audit trail and the metric tell them apart. A disabled account
// is recorded as such, not as a wrong password, so an investigator does not read a correct
// password as guessing.
export async function recordSignInFailure(
  context: AppContext,
  account: AttemptedAccount | null,
  outcome: { passwordWasRight: boolean; isActive: boolean; reachedLimit: boolean },
): Promise<void> {
  if (account && outcome.passwordWasRight && !outcome.isActive) {
    countSecurityEvent("auth.sign_in.failed", { reason: "disabled" });
    await recordAccountEvent(context, account, "LOGIN_REFUSED_DISABLED", {});
    if (outcome.reachedLimit) {
      await recordAccountEvent(context, account, "PASSWORD_CHECK_LOCKED", {
        action: "login",
      });
    }
    return;
  }

  countSecurityEvent("auth.sign_in.failed", {
    reason: account ? "wrong_password" : "unknown_email",
  });
  if (!account && !hasAuditBudget(context)) return;
  await recordWrongPassword(context, account, "login", outcome.reachedLimit);
}

function hasAuditBudget(context: AppContext): boolean {
  const key = `auditUnknown:${networkOf(context.req?.ip)}`;
  return reserveAttempt(key, Date.now(), MAX_UNKNOWN_EMAIL_AUDIT_ROWS).allowed;
}
