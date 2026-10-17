import assert from "node:assert/strict";
import { resolvers } from "../src/resolvers";

type UserRecord = { id: string; email: string; name: string };

const storedUsers: UserRecord[] = [
  { id: "user_1", email: "one@example.test", name: "One" },
  { id: "user_2", email: "two@example.test", name: "Two" },
];

function contextFor(user: { userId: string; email: string; role?: string } | null) {
  const prisma = { user: { findMany: async () => storedUsers } };
  return { prisma, user } as any;
}

async function callUsersQuery(context: any) {
  const usersResolver = (resolvers as any).Query.users;
  return usersResolver({}, {}, context);
}

async function rejectsAnonymousCaller() {
  await assert.rejects(
    () => callUsersQuery(contextFor(null)),
    /Authentication required/
  );
}

async function rejectsOrdinaryUser() {
  const ordinaryUser = { userId: "user_1", email: "one@example.test", role: "USER" };
  await assert.rejects(
    () => callUsersQuery(contextFor(ordinaryUser)),
    /Insufficient permissions/
  );
}

async function allowsAdminAndHidesPasswords() {
  const admin = { userId: "admin_1", email: "admin@example.test", role: "ADMIN" };
  const result = await callUsersQuery(contextFor(admin));
  assert.equal(result.length, storedUsers.length);
  assert.ok(result.every((user: any) => !("password" in user)));
}

async function main() {
  await rejectsAnonymousCaller();
  await rejectsOrdinaryUser();
  await allowsAdminAndHidesPasswords();
  console.log("usersQueryAuthorization tests passed");
}

// Importing the resolvers opens Redis and Prisma handles, so exit explicitly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
