import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "../types/context";

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
        sanitized[key] = preferences[key].slice(0, 300); // cap length
      }
    }

    const updated = await context.prisma.user.update({
      where: { id: userId },
      data: { preferences: JSON.stringify(sanitized) },
    });

    // Parse preferences back for the resolver to return the UserPreferences type
    return {
      ...updated,
      preferences: updated.preferences ? JSON.parse(updated.preferences) : null,
    };
  },
};