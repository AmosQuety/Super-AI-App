import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import express from "express";
import { forwardingHeaderForLog } from "../src/middleware/logging";
import {
  MAX_TRUST_PROXY_HOPS,
  parseTrustProxyHops,
} from "../src/config/trustProxy";

function unsetMeansOffSoNothingIsTrustedByDefault() {
  assert.equal(parseTrustProxyHops(undefined), false);
  assert.equal(parseTrustProxyHops(""), false);
  assert.equal(parseTrustProxyHops("  "), false);
  assert.equal(parseTrustProxyHops("0"), false);
}

function aWholeNumberOfHopsIsAccepted() {
  assert.equal(parseTrustProxyHops("1"), 1);
  assert.equal(parseTrustProxyHops(" 2 "), 2);
  assert.equal(parseTrustProxyHops(String(MAX_TRUST_PROXY_HOPS)), MAX_TRUST_PROXY_HOPS);
}

function anythingElseFailsLoudlyBecauseTrustingTooMuchIsDangerous() {
  for (const bad of ["true", "yes", "-1", "1.5", "abc", "1,2", "01", "00", "007", "+2", "1e1", "0x2", "２", String(MAX_TRUST_PROXY_HOPS + 1), "9999"]) {
    assert.throws(
      () => parseTrustProxyHops(bad),
      /TRUST_PROXY_HOPS/,
      `"${bad}" must be refused`,
    );
  }
}

// What the number actually does, against a real Express server that receives a request whose
// forwarding header already holds a forged address plus the one a trusted proxy appended.
async function clientAddressSeenBy(hops: string | undefined): Promise<string> {
  const app = express();
  app.set("trust proxy", parseTrustProxyHops(hops));
  app.get("/ip", (req, res) => void res.send(req.ip));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await new Promise<string>((resolve, reject) => {
      http
        .get(
          { port, host: "127.0.0.1", path: "/ip", headers: { "X-Forwarded-For": "6.6.6.6, 203.0.113.9" } },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve(body));
          },
        )
        .on("error", reject);
    });
  } finally {
    server.close();
  }
}

async function theNumberOfHopsDecidesWhichForwardedAddressIsBelieved() {
  assert.match(await clientAddressSeenBy(undefined), /127\.0\.0\.1/, "off: the direct peer");
  assert.equal(
    await clientAddressSeenBy("1"),
    "203.0.113.9",
    "one trusted proxy: the address it appended, not the forged leftmost one",
  );
  assert.equal(
    await clientAddressSeenBy("2"),
    "6.6.6.6",
    "too many hops trusts a caller-supplied address, which is why the value must match the real chain",
  );
}

function theForwardingHeaderIsLoggedSafely() {
  assert.equal(forwardingHeaderForLog("6.6.6.6, 203.0.113.9"), "6.6.6.6, 203.0.113.9");
  assert.equal(forwardingHeaderForLog(undefined), undefined);
  assert.equal(forwardingHeaderForLog(["1.1.1.1", "2.2.2.2"]), "1.1.1.1, 2.2.2.2");
  assert.equal(
    forwardingHeaderForLog("1.1.1.1\r\nlevel=error fake log line"),
    "1.1.1.1  level=error fake log line",
    "a caller cannot start a new log line",
  );
  assert.equal(forwardingHeaderForLog("9".repeat(5000))!.length, 200, "length is capped");
}

async function main() {
  theForwardingHeaderIsLoggedSafely();
  unsetMeansOffSoNothingIsTrustedByDefault();
  aWholeNumberOfHopsIsAccepted();
  anythingElseFailsLoudlyBecauseTrustingTooMuchIsDangerous();
  await theNumberOfHopsDecidesWhichForwardedAddressIsBelieved();
  console.log("trustProxy tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
