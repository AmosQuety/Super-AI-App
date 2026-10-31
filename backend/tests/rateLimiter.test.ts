import "./support/testEnvironment";
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import express from "express";
import { RateLimitService } from "../src/auth/rate-limiting";

const RENDER_CHAIN = (client: string) => `${client}, 172.70.250.154, 10.30.225.224`;

function status(port: number, client: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get(
        { port, host: "127.0.0.1", path: "/graphql", headers: { "X-Forwarded-For": RENDER_CHAIN(client) } },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        },
      )
      .on("error", reject);
  });
}

async function theGraphQLLimiterCapsEachClientSeparately() {
  const app = express();
  app.set("trust proxy", 3);
  app.use("/graphql", RateLimitService.getGraphQLLimiter());
  app.get("/graphql", (_req, res) => void res.send("ok"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    for (let i = 0; i < 100; i++) {
      assert.equal(await status(port, "41.210.145.140"), 200, `request ${i + 1} of 100 is allowed`);
    }
    assert.equal(await status(port, "41.210.145.140"), 429, "the 101st request in a minute is refused");
    assert.equal(
      await status(port, "34.145.120.165"),
      200,
      "another client has its own allowance",
    );
  } finally {
    server.close();
  }
}

theGraphQLLimiterCapsEachClientSeparately()
  .then(() => {
    console.log("rateLimiter tests passed");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
