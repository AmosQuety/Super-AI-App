import "./support/testEnvironment";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { webhookRouter } from "../src/services/webhooks";
import { redisClient } from "../src/lib/redis";
import { webhookCallbackUrl, webhookSecretProblem } from "../src/auth/webhookAuth";
import { loggableUrl, loggingMiddleware } from "../src/middleware/logging";
import { logger } from "../src/utils/logger";

const SECRET = "a-webhook-secret-of-sufficient-length";
const stored = new Map<string, string>();

function stubRedis() {
  if (!redisClient) throw new Error("these tests need the Redis client object to stub");
  (redisClient as any).setex = async (key: string, _ttl: number, value: string) => {
    stored.set(key, value);
  };
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use("/api/webhooks", webhookRouter);
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/webhooks/python`);
  } finally {
    server.close();
  }
}

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const completed = { jobId: "job_1", success: false, message: "boom", status: "FAILED", audioUrl: "https://example.test/a.mp3", junk: "x".repeat(50) };

async function rejectsEverythingWhenNoSecretIsConfigured() {
  delete process.env.WEBHOOK_SECRET;
  await withServer(async (base) => {
    assert.equal((await post(base, completed, { "x-webhook-secret": SECRET })).status, 401);
  });
  assert.equal(stored.size, 0);
}

async function rejectsMissingAndWrongSecrets() {
  process.env.WEBHOOK_SECRET = SECRET;
  await withServer(async (base) => {
    assert.equal((await post(base, completed)).status, 401);
    assert.equal((await post(base, completed, { "x-webhook-secret": "wrong" })).status, 401);
    assert.equal((await post(`${base}?secret=wrong`, completed)).status, 401);
  });
  assert.equal(stored.size, 0);
}

async function acceptsTheSecretInAHeaderOrTheUrlPath() {
  process.env.WEBHOOK_SECRET = SECRET;
  await withServer(async (base) => {
    assert.equal((await post(base, completed, { "x-webhook-secret": SECRET })).status, 200);
    // The engine uses the callback URL as given...
    assert.equal((await post(`${base}/cb/${SECRET}`, { ...completed, jobId: "job_2" })).status, 200);
    // ...or appends the job id to it.
    assert.equal((await post(`${base}/cb/${SECRET}/job_3`, { status: "COMPLETED" })).status, 200);
  });
  assert.ok(stored.has("JOB_STATUS_job_1") && stored.has("JOB_STATUS_job_2") && stored.has("JOB_STATUS_job_3"));
}

async function theSecretIsNotAcceptedInTheQueryString() {
  process.env.WEBHOOK_SECRET = SECRET;
  await withServer(async (base) => {
    assert.equal((await post(`${base}?secret=${SECRET}`, { ...completed, jobId: "job_4" })).status, 401);
    assert.equal((await post(`${base}/cb/wrong-secret`, { ...completed, jobId: "job_4" })).status, 401);
  });
  assert.equal(stored.has("JOB_STATUS_job_4"), false);
}

async function storesOnlyTheKnownFields() {
  const record = JSON.parse(stored.get("JOB_STATUS_job_1") as string);
  assert.equal(record.status, "FAILED");
  assert.equal(record.success, false);
  assert.equal(record.message, "boom");
  assert.equal(record.audioUrl, "https://example.test/a.mp3");
  assert.equal("junk" in record, false);
}

async function rejectsMalformedJobIds() {
  process.env.WEBHOOK_SECRET = SECRET;
  await withServer(async (base) => {
    const response = await post(base, { ...completed, jobId: "../../etc/passwd" }, { "x-webhook-secret": SECRET });
    assert.equal(response.status, 400);
  });
}

function callbackUrlCarriesTheSecretOnlyWhenConfigured() {
  process.env.APP_URL = "https://api.example.test";
  process.env.WEBHOOK_SECRET = SECRET;
  assert.equal(webhookCallbackUrl(), `https://api.example.test/api/webhooks/python/cb/${SECRET}`);
  delete process.env.WEBHOOK_SECRET;
  assert.equal(webhookCallbackUrl(), "https://api.example.test/api/webhooks/python");
}

function logsNeverContainTheSecret() {
  assert.equal(loggableUrl("/api/webhooks/python/cb/abc123/job_9?x=1"), "/api/webhooks/python/cb/[redacted]/job_9?x=1");
  assert.equal(loggableUrl("/api/webhooks/python?secret=abc123&x=1"), "/api/webhooks/python?secret=[redacted]&x=1");
  assert.equal(loggableUrl("/graphql"), "/graphql");
}

// Checks what the logger actually receives, not just the URL helper.
function theRequestLoggerNeverReceivesTheSecret() {
  const captured: string[] = [];
  const originals = { debug: logger.debug, info: logger.info };
  (logger as any).debug = (...args: unknown[]) => captured.push(JSON.stringify(args));
  (logger as any).info = (...args: unknown[]) => captured.push(JSON.stringify(args));
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const req: any = {
      method: "POST",
      url: `/api/webhooks/python/cb/${SECRET}/job_9?secret=${SECRET}`,
      path: `/python/cb/${SECRET}/job_9`,
      query: { secret: SECRET },
      get: () => undefined,
      ip: "127.0.0.1",
      connection: {},
    };
    const res: any = { send() {}, on() {}, get: () => undefined };
    loggingMiddleware(req, res, () => {});
  } finally {
    process.env.NODE_ENV = previousEnv;
    (logger as any).debug = originals.debug;
    (logger as any).info = originals.info;
  }
  assert.ok(captured.length > 0, "the middleware should have logged the request");
  assert.equal(captured.join("").includes(SECRET), false);
}

function theStartupCheckNamesAMissingOrShortSecret() {
  delete process.env.WEBHOOK_SECRET;
  assert.match(String(webhookSecretProblem()), /WEBHOOK_SECRET/);
  process.env.WEBHOOK_SECRET = "short";
  assert.match(String(webhookSecretProblem()), /16 characters/);
  process.env.WEBHOOK_SECRET = SECRET;
  assert.equal(webhookSecretProblem(), null);
}

async function main() {
  stubRedis();
  await rejectsEverythingWhenNoSecretIsConfigured();
  await rejectsMissingAndWrongSecrets();
  await acceptsTheSecretInAHeaderOrTheUrlPath();
  await theSecretIsNotAcceptedInTheQueryString();
  await storesOnlyTheKnownFields();
  await rejectsMalformedJobIds();
  callbackUrlCarriesTheSecretOnlyWhenConfigured();
  logsNeverContainTheSecret();
  theRequestLoggerNeverReceivesTheSecret();
  theStartupCheckNamesAMissingOrShortSecret();
  console.log("webhookAuth tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
