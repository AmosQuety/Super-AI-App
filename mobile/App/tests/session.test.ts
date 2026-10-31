import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  decodeBase64Url,
  isSessionExpired,
  isRejectionForCurrentSession,
  msUntilExpiry,
} from '../libs/session';

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function tokenExpiringAt(expMs: number): string {
  const header = encodeSegment({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeSegment({ userId: 'u1', exp: Math.floor(expMs / 1000) });
  return `${header}.${payload}.signature`;
}

test('a token that expired in the past is expired', () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW - 60_000), NOW), true);
});

test('a token valid for hours is not expired', () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW + 3 * 3_600_000), NOW), false);
});

test('a token about to expire counts as expired, so a request never starts with it', () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW + 10_000), NOW), true);
});

test('a token just outside the skew window is still valid', () => {
  assert.equal(isSessionExpired(tokenExpiringAt(NOW + 31_000), NOW), false);
});

test('a missing, malformed or expiry-less token fails closed', () => {
  const noExpiry = `${encodeSegment({})}.${encodeSegment({ userId: 'u1' })}.x`;
  const nonNumericExpiry = `${encodeSegment({})}.${encodeSegment({ exp: 'soon' })}.x`;
  const tokens = [null, '', 'not-a-token', 'a.b.c', 'a.%%%.c', noExpiry, nonNumericExpiry];
  for (const token of tokens) {
    assert.equal(isSessionExpired(token, NOW), true, `token ${String(token)}`);
  }
});

test('payloads that need base64url padding or use - and _ decode correctly', () => {
  // Names chosen so the encoded payload length is not a multiple of 4 and contains url-safe characters.
  for (const name of ['a', 'ab', 'abc', '??>>', '~~~~']) {
    const exp = Math.floor((NOW + 3_600_000) / 1000);
    const token = `${encodeSegment({})}.${encodeSegment({ name, exp })}.x`;
    assert.equal(isSessionExpired(token, NOW), false, `name ${name}`);
  }
});

test("msUntilExpiry counts down to the token's expiry and never goes negative", () => {
  assert.equal(msUntilExpiry(tokenExpiringAt(NOW + 90_000), NOW), 90_000);
  assert.equal(msUntilExpiry(tokenExpiringAt(NOW - 5_000), NOW), 0);
  assert.equal(msUntilExpiry('garbage', NOW), 0);
  assert.equal(msUntilExpiry(null, NOW), 0);
});

test('base64url decoding handles multi-byte UTF-8 exactly like Buffer', () => {
  for (const text of ['Zoë', '日本語', 'emoji 😀 mix', 'ASCII only', '']) {
    assert.equal(decodeBase64Url(Buffer.from(text).toString('base64url')), text);
  }
});

test('base64url decoding accepts padding and rejects characters outside the alphabet', () => {
  assert.equal(decodeBase64Url(Buffer.from('ab').toString('base64')), 'ab');
  assert.throws(() => decodeBase64Url('a+b/'));
});

test('a token whose payload has non-ASCII claims still has its expiry read', () => {
  const payload = encodeSegment({ name: 'Zoë 日本 😀', exp: Math.floor((NOW + 3_600_000) / 1000) });
  const token = `${encodeSegment({ alg: 'HS256' })}.${payload}.signature`;
  assert.equal(isSessionExpired(token, NOW), false);
});

test('a rejection only ends the session that sent the rejected request', () => {
  // Same token still stored: the rejection is about the current session.
  assert.equal(isRejectionForCurrentSession('token-a', 'token-a'), true);
  // The user signed in again (or out) since the request was sent: ignore the stale rejection.
  assert.equal(isRejectionForCurrentSession('token-a', 'token-b'), false);
  assert.equal(isRejectionForCurrentSession('token-a', null), false);
  assert.equal(isRejectionForCurrentSession(undefined, 'token-b'), false);
  // A request sent without a token while nobody is signed in: nothing newer to protect.
  assert.equal(isRejectionForCurrentSession(undefined, null), true);
});
