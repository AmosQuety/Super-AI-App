import { UserInputError } from "apollo-server-express";

// bcrypt only reads the first 72 bytes of a password, so two longer passwords that
// share their first 72 bytes would be accepted as each other. New passwords are capped
// instead of silently truncated. The limit is in bytes, not characters: an emoji is
// 4 bytes and an accented letter is usually 2.
export const MAX_PASSWORD_BYTES = 72;

// Applies to new passwords only (register, changePassword). Login is deliberately not
// capped: an older account may hold a longer password that still verifies under
// truncation, and rejecting it would lock that user out.
export function assertPasswordWithinByteLimit(password: string): void {
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new UserInputError(
      `Password must be at most ${MAX_PASSWORD_BYTES} bytes long (fewer characters if it contains emoji or accented letters)`
    );
  }
}
