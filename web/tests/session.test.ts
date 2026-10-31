import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPublicRoute,
  isSessionExpired,
  loginRedirectUrl,
  msUntilExpiry,
} from "../src/utils/session.ts";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);

function tokenExpiringAt(expMs: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ userId: "u1", exp: Math.floor(expMs / 1000) })}.signature`;
}

test("a token that expired in the past is expired", () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW - 60_000), NOW), true);
});

test("a token valid for hours is not expired", () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW + 3 * 3_600_000), NOW), false);
});

test("a token about to expire counts as expired, so a request never starts with it", () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW + 10_000), NOW), true);
});

test("a missing, malformed or expiry-less token fails closed", () => {
  const noExpiry = `${Buffer.from("{}").toString("base64url")}.${Buffer.from('{"userId":"u1"}').toString("base64url")}.x`;
  for (const token of [null, "", "not-a-token", "a.b.c", "a.%%%.c", noExpiry]) {
    assert.equal(isSessionExpired(token, NOW), true, `token ${String(token)}`);
  }
});

test("msUntilExpiry counts down to the token's expiry and never goes negative", () => {
  assert.equal(msUntilExpiry(tokenExpiringAt(NOW + 90_000), NOW), 90_000);
  assert.equal(msUntilExpiry(tokenExpiringAt(NOW - 5_000), NOW), 0);
  assert.equal(msUntilExpiry("garbage", NOW), 0);
});

test("the login redirect keeps the page the user was on", () => {
  assert.equal(loginRedirectUrl("/chat", ""), "/login?returnTo=%2Fchat");
  assert.equal(loginRedirectUrl("/settings", "?tab=push"), "/login?returnTo=%2Fsettings%3Ftab%3Dpush");
});

test("only the landing, login and register pages are public", () => {
  for (const path of ["/", "/login", "/register"]) assert.equal(isPublicRoute(path), true);
  for (const path of ["/chat", "/settings", "/login/extra"]) assert.equal(isPublicRoute(path), false);
});
