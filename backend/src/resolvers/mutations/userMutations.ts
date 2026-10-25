import { AuthenticationError, UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";

// The four fixed-choice settings feed the chat assistant's instructions; anything else is refused
// rather than stored. Free-text settings are capped below.
const ALLOWED_CHOICES: Record<string, string[]> = {
  tone: ["casual", "formal"],
  detail: ["concise", "detailed"],
  techDepth: ["beginner", "intermediate", "expert"],
  responseFormat: ["prose", "bullets", "mixed"],
};

const MAX_FREE_TEXT = 300;

export const userMutations = {
  
  updatePreferences: async (
    _: any,
    { preferences }: { preferences: Record<string, string> },
    context: AppContext
  ) => {
    const userId = context.user?.userId || (context.user as any)?.id;
    if (!userId) throw new AuthenticationError("Login required");

    // Sanitize: only allow known keys to prevent injection
    const allowedKeys = ['tone', 'detail', 'techDepth', 'responseFormat', 'role', 'domain', 'goals', 'language'];
    const sanitized: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (typeof preferences[key] === 'string') {
        const allowed = ALLOWED_CHOICES[key];
        if (allowed && !allowed.includes(preferences[key])) {
          throw new UserInputError(`Invalid value for ${key}`);
        }
        if (preferences[key].length > MAX_FREE_TEXT) {
          throw new UserInputError(`${key} must be at most ${MAX_FREE_TEXT} characters`);
        }
        sanitized[key] = preferences[key];
      }
    }

    // The User.preferences field resolver parses the stored JSON string, so return it as stored.
    return context.prisma.user.update({
      where: { id: userId },
      data: { preferences: JSON.stringify(sanitized) },
    });
  },
};