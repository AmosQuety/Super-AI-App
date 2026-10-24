import "./support/testEnvironment";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { webhookRouter } from "../src/services/webhooks";
import { redisClient } from "../src/lib/redis";
import { webhookCallbackUrl } from "../src/auth/webhookAuth";
import { loggableUrl } from "../src/middleware/logging";

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

async function acceptsTheSecretInAHeaderOrTheQuery() {
  process.env.WEBHOOK_SECRET = SECRET;
  await withServer(async (base) => {
    assert.equal((await post(base, completed, { "x-webhook-secret": SECRET })).status, 200);
    assert.equal((await post(`${base}?secret=${SECRET}`, { ...completed, jobId: "job_2" })).status, 200);
  });
  assert.ok(stored.has("JOB_STATUS_job_1") && stored.has("JOB_STATUS_job_2"));
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
  assert.equal(webhookCallbackUrl(), `https://api.example.test/api/webhooks/python?secret=${SECRET}`);
  delete process.env.WEBHOOK_SECRET;
  assert.equal(webhookCallbackUrl(), "https://api.example.test/api/webhooks/python");
}

function logsNeverContainTheSecret() {
  assert.equal(loggableUrl("/api/webhooks/python?secret=abc123&x=1"), "/api/webhooks/python?secret=[redacted]&x=1");
  assert.equal(loggableUrl("/graphql"), "/graphql");
}

async function main() {
  stubRedis();
  await rejectsEverythingWhenNoSecretIsConfigured();
  await rejectsMissingAndWrongSecrets();
  await acceptsTheSecretInAHeaderOrTheQuery();
  await storesOnlyTheKnownFields();
  await rejectsMalformedJobIds();
  callbackUrlCarriesTheSecretOnlyWhenConfigured();
  logsNeverContainTheSecret();
  console.log("webhookAuth tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
