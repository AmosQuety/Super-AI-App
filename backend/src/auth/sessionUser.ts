import { SecurityConfig, JWTPayload } from "./security";
import { logger } from "../utils/logger";

export interface StoredAccount {
  role: string;
  isActive: boolean;
}

export type AccountLookup = (userId: string) => Promise<StoredAccount | null>;

// A token proves who the caller is, but only the database knows what they may do
// today. The role is re-read on every request, so a demotion, a disabled account
// or a deleted user takes effect immediately instead of when the token expires.
// Anything that cannot be confirmed (bad token, missing or disabled account,
// lookup failure) yields no session.
export async function authenticateToken(
  token: string | undefined,
  lookupAccount: AccountLookup
): Promise<JWTPayload | null> {
  if (!token) return null;

  let claims: JWTPayload;
  try {
    claims = SecurityConfig.verifyToken(token);
  } catch {
    logger.warn("[context] invalid or expired token");
    return null;
  }

  try {
    const account = await lookupAccount(claims.userId);
    if (!account || !account.isActive) {
      logger.warn("[context] token belongs to a missing or disabled account");
      return null;
    }
    return { ...claims, role: SecurityConfig.roleForToken(account.role) };
  } catch (error: any) {
    logger.error("[context] account lookup failed; treating the caller as anonymous", { error: error.message });
    return null;
  }
}
