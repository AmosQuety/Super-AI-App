import { UserInputError } from "apollo-server-express";
import bcrypt from "bcryptjs";
import { AppContext } from "../resolvers/types/context";
import { recordAccountEvent } from "./accountAudit";
import { clearFailedAttempts, reserveAttempt } from "./passwordAttempts";

// Counters for "current password" checks and for sign-in are kept apart, so locking one never
// blocks the other.
export const passwordCheckKey = (userId: string) => `password:${userId}`;
export const signInKey = (email: string) =>
  `login:${email.toLowerCase().trim()}`;

export type PasswordCheckedAction =
  "change_email" | "change_password" | "login";

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

  const attempt = reserveAttempt(passwordCheckKey(account.id));
  if (!attempt.allowed) {
    const minutes = Math.ceil(attempt.retryAfterMs / 60_000);
    throw new UserInputError(
      `Too many incorrect passwords. Try again in ${minutes} minutes.`,
    );
  }

  if (await bcrypt.compare(supplied, account.password)) {
    clearFailedAttempts(passwordCheckKey(account.id));
    return;
  }

  await recordWrongPassword(context, account, action, attempt.isLastAllowed);
  throw new UserInputError("Current password is incorrect");
}

// Never put the typed password in here: only the action is recorded.
export async function recordWrongPassword(
  context: AppContext,
  account: { id: string; email: string },
  action: PasswordCheckedAction,
  reachedLimit: boolean,
): Promise<void> {
  await recordAccountEvent(context, account, "PASSWORD_CHECK_FAILED", {
    action,
  });
  if (reachedLimit) {
    await recordAccountEvent(context, account, "PASSWORD_CHECK_LOCKED", {
      action,
    });
  }
}
