import "./support/testEnvironment";
import assert from "node:assert/strict";
import { SecurityConfig } from "../src/auth/security";

const originalSecret = process.env.JWT_SECRET;
const STRONG_SECRET = "a-test-secret-that-is-comfortably-longer-than-32-characters";

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
signingFailsInsteadOfUsingAFallbackWhenTheSecretIsMissing();
console.log("jwtSecret tests passed");
process.exit(0);
