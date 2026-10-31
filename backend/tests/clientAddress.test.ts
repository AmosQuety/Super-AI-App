import assert from "node:assert/strict";
import express from "express";
import { addressFromRequest } from "../src/auth/clientAddress";
import { parseTrustProxyHops } from "../src/config/trustProxy";

const upgrade = (forwardedFor: string | undefined) =>
  ({
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
    socket: { remoteAddress: "10.0.0.7" },
  }) as any;

function appTrusting(hops: string | undefined) {
  const app = express();
  app.set("trust proxy", parseTrustProxyHops(hops));
  return app;
}

function aWebSocketUpgradeIsReadLikeAnHttpRequestWithTheSameHopCount() {
  const forged = "6.6.6.6, 203.0.113.9";
  assert.equal(addressFromRequest(appTrusting(undefined), upgrade(forged)), "10.0.0.7");
  assert.equal(addressFromRequest(appTrusting("1"), upgrade(forged)), "203.0.113.9");
  assert.equal(addressFromRequest(appTrusting("2"), upgrade(forged)), "6.6.6.6");
}

function aMissingHeaderOrRequestFallsBackToTheSocketOrNothing() {
  assert.equal(addressFromRequest(appTrusting("1"), upgrade(undefined)), "10.0.0.7");
  assert.equal(addressFromRequest(appTrusting("1"), undefined), undefined);
  assert.equal(addressFromRequest(appTrusting("1"), { headers: {} } as any), undefined);
}

aWebSocketUpgradeIsReadLikeAnHttpRequestWithTheSameHopCount();
aMissingHeaderOrRequestFallsBackToTheSocketOrNothing();
console.log("clientAddress tests passed");
