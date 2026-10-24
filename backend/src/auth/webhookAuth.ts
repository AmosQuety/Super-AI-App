import crypto from "crypto";

const MIN_SECRET_LENGTH = 16;
const CALLBACK_PATH = "/api/webhooks/python";

function configuredSecret(): string | null {
  const secret = process.env.WEBHOOK_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

// Fails closed: with no usable WEBHOOK_SECRET configured, no caller is accepted.
export function isValidWebhookSecret(provided: unknown): boolean {
  const secret = configuredSecret();
  if (!secret || typeof provided !== "string") return false;

  // Hash both sides so the comparison is constant-time regardless of length.
  const providedDigest = crypto.createHash("sha256").update(provided).digest();
  const expectedDigest = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

// The URL handed to the AI engine for each job. The engine posts back to exactly
// this URL, so carrying the secret in it needs no change on the engine side.
export function webhookCallbackUrl(): string {
  const baseUrl = process.env.APP_URL || "http://localhost:4001";
  const secret = configuredSecret();
  return secret
    ? `${baseUrl}${CALLBACK_PATH}?secret=${encodeURIComponent(secret)}`
    : `${baseUrl}${CALLBACK_PATH}`;
}
