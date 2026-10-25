import { UserInputError } from "apollo-server-express";
import bcrypt from "bcryptjs";
import { AppContext } from "../resolvers/types/context";
import { recordAccountEvent } from "./accountAudit";
import { clearFailedAttempts, reserveAttempt } from "./passwordAttempts";

export type PasswordCheckedAction = "change_email" | "change_password";

// Confirms the signed-in user knows their current password before a sensitive change. A wrong
// answer is a validation error, not UNAUTHENTICATED, because clients sign the user out on that.
// Attempts are limited per user and wrong answers are written to the audit trail (the action
// only, never the text that was typed). An empty answer is not a guess and is not counted.
export async function verifyCurrentPassword(
  context: AppContext,
  account: { id: string; email: string; password: string },
  supplied: string,
  action: PasswordCheckedAction,
): Promise<void> {
  if (supplied.length === 0) {
    throw new UserInputError("Enter your current password");
  }

  const attempt = reserveAttempt(account.id);
  if (!attempt.allowed) {
    const minutes = Math.ceil(attempt.retryAfterMs / 60_000);
    throw new UserInputError(
      `Too many incorrect passwords. Try again in ${minutes} minutes.`,
    );
  }

  if (await bcrypt.compare(supplied, account.password)) {
    clearFailedAttempts(account.id);
    return;
  }

  await recordAccountEvent(context, account, "PASSWORD_CHECK_FAILED", {
    action,
  });
  if (attempt.isLastAllowed) {
    await recordAccountEvent(context, account, "PASSWORD_CHECK_LOCKED", {
      action,
    });
  }
  throw new UserInputError("Current password is incorrect");
}
