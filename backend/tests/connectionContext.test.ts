import "./support/testEnvironment";
import assert from "node:assert/strict";
import { createContext } from "../src/resolvers/types/context";

const noAccount = async () => null;

async function aWebSocketCallerIsIdentifiedByItsSocketAddress() {
  const context = await createContext({
    connection: {
      connectionParams: {},
      extra: {
        request: {
          socket: { remoteAddress: "203.0.113.5" },
          headers: { "user-agent": "mobile-app/1.0" },
        },
      },
    },
    lookupAccount: noAccount,
  });
  assert.equal(context.req.ip, "203.0.113.5");
  assert.equal(context.req.headers["user-agent"], "mobile-app/1.0");
}

async function aSuppliedResolverDecidesTheAddress() {
  const request = { socket: { remoteAddress: "10.0.0.7" }, headers: { "x-forwarded-for": "203.0.113.9" } };
  const context = await createContext({
    connection: { connectionParams: {}, extra: { request } },
    resolveAddress: (seen: unknown) => (seen === request ? "203.0.113.9" : "wrong"),
    lookupAccount: noAccount,
  });
  assert.equal(context.req.ip, "203.0.113.9");
}

async function aConnectionWithoutARequestStillHasAnEmptyClientInfo() {
  const context = await createContext({
    connection: { connectionParams: {} },
    lookupAccount: noAccount,
  });
  assert.equal(context.req.ip, undefined);
  assert.deepEqual(context.req.headers, {});
}

async function anHttpRequestIsLeftAsItIs() {
  const req = { ip: "198.51.100.7", headers: {} };
  const context = await createContext({ req, lookupAccount: noAccount });
  assert.equal(context.req, req as any);
}

async function main() {
  await aWebSocketCallerIsIdentifiedByItsSocketAddress();
  await aSuppliedResolverDecidesTheAddress();
  await aConnectionWithoutARequestStillHasAnEmptyClientInfo();
  await anHttpRequestIsLeftAsItIs();
  console.log("connectionContext tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
