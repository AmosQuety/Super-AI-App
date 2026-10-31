import { AuthenticationError, UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { recordAccountEvent } from "../../auth/accountAudit";

// The four fixed-choice settings feed the chat assistant's instructions; anything else is refused
// rather than stored. Free-text settings are capped below.
const ALLOWED_CHOICES: Record<string, string[]> = {
  tone: ["casual", "formal"],
  detail: ["concise", "detailed"],
  techDepth: ["beginner", "intermediate", "expert"],
  responseFormat: ["prose", "bullets", "mixed"],
};

// Only these keys are ever stored, which keeps arbitrary client data out of the record.
const ALLOWED_KEYS = ["tone", "detail", "techDepth", "responseFormat", "role", "domain", "goals", "language"];
const MAX_FREE_TEXT = 300;
const MAX_SAVE_ATTEMPTS = 3;

function preferenceProblem(key: string, value: string): string | null {
  const choices = ALLOWED_CHOICES[key];
  if (choices && !choices.includes(value)) return `Invalid value for ${key}`;
  if (value.length > MAX_FREE_TEXT) return `${key} must be at most ${MAX_FREE_TEXT} characters`;
  return null;
}

function acceptedPreferences(input: Record<string, unknown>): Record<string, string> {
  const accepted: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = input[key];
    if (typeof value !== "string") continue;
    const problem = preferenceProblem(key, value);
    if (problem) throw new UserInputError(problem);
    accepted[key] = value;
  }
  return accepted;
}

// What is already stored is checked again on every merge: older records were written before these
// rules existed. Entries that no longer pass are dropped, and an unreadable record counts as empty,
// so neither can block saving new settings.
function storedPreferences(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const kept: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === "string" && preferenceProblem(key, value) === null) kept[key] = value;
  }
  return kept;
}

export const userMutations = {
  updatePreferences: async (
    _: any,
    { preferences }: { preferences: Record<string, string> },
    context: AppContext
  ) => {
    const userId = context.user?.userId || (context.user as any)?.id;
    if (!userId) throw new AuthenticationError("Login required");

    const supplied = acceptedPreferences(preferences);

    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
      const account = await context.prisma.user.findUnique({ where: { id: userId } });
      if (!account) throw new AuthenticationError("User not found");

      const current = storedPreferences(account.preferences);
      const changed = Object.keys(supplied)
        .filter((key) => current[key] !== supplied[key])
        .sort();
      if (changed.length === 0) return account;

      // A partial update keeps the settings it does not mention. The write only applies if the
      // record is still what was read, so two devices saving at once cannot overwrite each other.
      const merged = { ...current, ...supplied };
      const { count } = await context.prisma.user.updateMany({
        where: { id: userId, preferences: account.preferences },
        data: { preferences: JSON.stringify(merged) },
      });
      if (count === 0) continue;

      // Field names only: free-text settings are personal and stay out of the audit trail.
      await recordAccountEvent(context, account, "PREFERENCES_UPDATED", { changed });
      // The User.preferences field resolver parses the stored JSON string, so return it as stored.
      return context.prisma.user.findUnique({ where: { id: userId } });
    }
    throw new UserInputError("Your settings changed while saving. Please try again.");
  },
};
