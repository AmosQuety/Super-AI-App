import "./support/testEnvironment";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { SecurityConfig } from "../src/auth/security";

const originalSecret = process.env.JWT_SECRET;
const STRONG_SECRET = "a-test-secret-that-is-comfortably-longer-than-32-characters";
// The value the code used to fall back to when the real secret was missing.
const FORMER_FALLBACK = "fallback-secret-key-must-be-long-enough-for-signing";

function withSecret(value: string | undefined, run: () => void) {
  if (value === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = value;
  try {
    run();
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
}

function refusesAMissingSecret() {
  withSecret(undefined, () => assert.throws(() => SecurityConfig.getJWTConfig(), /JWT_SECRET/));
}

function refusesAShortSecret() {
  withSecret("too-short", () => assert.throws(() => SecurityConfig.getJWTConfig(), /32 characters/));
}

function refusesTheDocumentedPlaceholder() {
  withSecret("your-super-secret-jwt-key-at-least-32-chars", () =>
    assert.throws(() => SecurityConfig.getJWTConfig(), /default/i)
  );
}

function acceptsAStrongSecret() {
  withSecret(STRONG_SECRET, () => assert.equal(SecurityConfig.getJWTConfig().secret, STRONG_SECRET));
}

function aTokenSignedWithTheFormerFallbackIsRejected() {
  const forged = jwt.sign(
    { userId: "attacker", email: "a@example.test", role: "ADMIN", sessionId: "x" },
    FORMER_FALLBACK,
    { expiresIn: "1h", issuer: "blaze-chat-app", audience: "blaze-chat-users" }
  );
  withSecret(STRONG_SECRET, () => assert.throws(() => SecurityConfig.verifyToken(forged), /Invalid token/));
}

function signingFailsInsteadOfUsingAFallbackWhenTheSecretIsMissing() {
  withSecret(undefined, () =>
    assert.throws(
      () => SecurityConfig.createToken({ userId: "u", email: "u@example.test", role: "USER" }),
      /JWT_SECRET/
    )
  );
}

refusesAMissingSecret();
refusesAShortSecret();
refusesTheDocumentedPlaceholder();
acceptsAStrongSecret();
aTokenSignedWithTheFormerFallbackIsRejected();
signingFailsInsteadOfUsingAFallbackWhenTheSecretIsMissing();
console.log("jwtSecret tests passed");
process.exit(0);
