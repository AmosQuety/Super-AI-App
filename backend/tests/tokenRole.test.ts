import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { graphql } from "graphql";
import { typeDefs } from "../src/schema/schema";
import { resolvers } from "../src/resolvers";
import { SecurityConfig } from "../src/auth/security";

function roleInToken(token: string) {
  return SecurityConfig.verifyToken(token).role;
}

function generateTokenKeepsKnownRoles() {
  for (const role of ["USER", "MODERATOR", "ADMIN"]) {
    const token = SecurityConfig.generateToken({ id: "u1", email: "u1@example.test", role });
    assert.equal(roleInToken(token), role);
  }
}

function generateTokenFallsBackToLeastPrivilege() {
  for (const storedRole of ["admin", "SUPERUSER", "constructor", "__proto__", "", null, undefined]) {
    const token = SecurityConfig.generateToken({ id: "u1", email: "u1@example.test", role: storedRole });
    assert.equal(roleInToken(token), "USER", `stored role ${String(storedRole)}`);
  }
}

async function loginWithStoredRole(role: string) {
  const user = {
    id: "u1",
    email: "u1@example.test",
    name: "U One",
    password: await bcrypt.hash("correct-password", 4),
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const source =
    'mutation { login(email: "u1@example.test", password: "correct-password") { token user { id } } }';
  const contextValue = { prisma: { user: { findUnique: async () => user } }, user: null };
  const result: any = await graphql({ schema, source, contextValue });
  assert.equal(result.errors, undefined);
  return roleInToken(result.data.login.token);
}

async function passwordLoginCarriesTheStoredRole() {
  assert.equal(await loginWithStoredRole("ADMIN"), "ADMIN");
  assert.equal(await loginWithStoredRole("USER"), "USER");
}

async function passwordLoginDoesNotTrustUnknownRoles() {
  assert.equal(await loginWithStoredRole("SUPERUSER"), "USER");
}

async function main() {
  generateTokenKeepsKnownRoles();
  generateTokenFallsBackToLeastPrivilege();
  await passwordLoginCarriesTheStoredRole();
  await passwordLoginDoesNotTrustUnknownRoles();
  console.log("tokenRole tests passed");
}

// Importing the resolvers opens Redis and Prisma handles, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
