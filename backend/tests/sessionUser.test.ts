import "./support/testEnvironment";
import assert from "node:assert/strict";
import { SecurityConfig } from "../src/auth/security";
import { authenticateToken, StoredAccount } from "../src/auth/sessionUser";
import { createContext } from "../src/resolvers/types/context";

const STORED_HASH = "stored-password-hash-1";

function tokenFor(role: string, passwordHash: string = STORED_HASH) {
  return SecurityConfig.createToken({ userId: "u1", email: "u1@example.test", role, pwf: SecurityConfig.passwordFingerprint(passwordHash) });
}

function account(role: string, isActive = true, password: string | null = STORED_HASH): StoredAccount {
  return { role, isActive, password };
}

function lookupReturning(account: StoredAccount | null) {
  const calls: string[] = [];
  const lookup = async (userId: string) => {
    calls.push(userId);
    return account;
  };
  return { lookup, calls };
}

async function theStoredRoleOverridesTheRoleInTheToken() {
  const promoted = await authenticateToken(tokenFor("USER"), lookupReturning(account("ADMIN")).lookup);
  assert.equal(promoted?.role, "ADMIN");

  const demoted = await authenticateToken(tokenFor("ADMIN"), lookupReturning(account("USER")).lookup);
  assert.equal(demoted?.role, "USER");
}

async function anUnknownStoredRoleBecomesUser() {
  const user = await authenticateToken(tokenFor("ADMIN"), lookupReturning(account("SUPERUSER")).lookup);
  assert.equal(user?.role, "USER");
}

async function aDisabledOrDeletedAccountHasNoSession() {
  assert.equal(await authenticateToken(tokenFor("ADMIN"), lookupReturning(account("ADMIN", false)).lookup), null);
  assert.equal(await authenticateToken(tokenFor("ADMIN"), lookupReturning(null).lookup), null);
}

// A database outage must not look like "your session was rejected", or clients log everyone out.
async function aFailedLookupIsARetryableErrorNotAnAnonymousCaller() {
  const failing = async () => {
    throw new Error("database unavailable");
  };
  await assert.rejects(() => authenticateToken(tokenFor("ADMIN"), failing), /temporarily unavailable/);
}

async function badOrMissingTokensNeverReachTheDatabase() {
  const { lookup, calls } = lookupReturning(account("ADMIN"));
  assert.equal(await authenticateToken(undefined, lookup), null);
  assert.equal(await authenticateToken("not-a-token", lookup), null);
  assert.equal(calls.length, 0);
}

async function contextUsesTheLiveAccountForHttpAndWebSocket() {
  const token = tokenFor("USER");
  const lookupAccount = lookupReturning(account("ADMIN")).lookup;

  const http = await createContext({ req: { headers: { authorization: `Bearer ${token}` } }, lookupAccount });
  assert.equal(http.user?.role, "ADMIN");

  const ws = await createContext({ connection: { connectionParams: { authToken: token } }, lookupAccount });
  assert.equal(ws.user?.role, "ADMIN");

  const disabled = lookupReturning(account("ADMIN", false)).lookup;
  const refused = await createContext({ req: { headers: { authorization: `Bearer ${token}` } }, lookupAccount: disabled });
  assert.equal(refused.user, null);
}

async function main() {
  await theStoredRoleOverridesTheRoleInTheToken();
  await anUnknownStoredRoleBecomesUser();
  await aDisabledOrDeletedAccountHasNoSession();
  await aFailedLookupIsARetryableErrorNotAnAnonymousCaller();
  await badOrMissingTokensNeverReachTheDatabase();
  await contextUsesTheLiveAccountForHttpAndWebSocket();
  console.log("sessionUser tests passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
