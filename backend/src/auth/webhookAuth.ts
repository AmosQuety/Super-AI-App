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

// Startup diagnostic: callbacks are rejected without a usable secret, and voice jobs
// then rely on the polling fallback.
export function webhookSecretProblem(): string | null {
  if (configuredSecret()) return null;
  return `WEBHOOK_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters; voice-engine callbacks will be rejected`;
}

// The URL handed to the AI engine for each job. The engine posts back to exactly this
// URL, or to it with the job id appended; the secret sits in the path so both work
// and no engine change is needed. Paths are redacted from our logs (see loggableUrl).
export function webhookCallbackUrl(): string {
  const baseUrl = process.env.APP_URL || "http://localhost:4001";
  const secret = configuredSecret();
  return secret
    ? `${baseUrl}${CALLBACK_PATH}/cb/${encodeURIComponent(secret)}`
    : `${baseUrl}${CALLBACK_PATH}`;
}
