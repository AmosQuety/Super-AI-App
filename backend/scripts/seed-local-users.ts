// Creates the test account in the LOCAL development database only.
// Run through the guard so it can never touch the cloud database:
//   ./scripts/local-env.sh npx ts-node scripts/seed-local-users.ts
// The password comes from LOCAL_TEST_USER_PASSWORD in the gitignored .env.local.
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const BCRYPT_COST = 12;
const TEST_USER_EMAIL = "agent-test@xemora.local";
const TEST_USER_NAME = "Agent Test";

const prisma = new PrismaClient();

function readTestUserPassword(): string {
  const password = process.env.LOCAL_TEST_USER_PASSWORD;
  if (!password) {
    throw new Error("LOCAL_TEST_USER_PASSWORD is not set in .env.local");
  }
  return password;
}

async function seedTestUser(): Promise<void> {
  const passwordHash = await hash(readTestUserPassword(), BCRYPT_COST);
  await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { password: passwordHash },
    create: { email: TEST_USER_EMAIL, name: TEST_USER_NAME, password: passwordHash },
  });
  console.log(`Test user ready: ${TEST_USER_EMAIL}`);
}

seedTestUser()
  .catch((error) => {
    console.error("Seeding the test user failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
