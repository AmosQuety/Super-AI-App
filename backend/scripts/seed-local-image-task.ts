// Creates (or refreshes) one FINISHED image task with four tiny images for the test account in the
// LOCAL development database only, so the app's "restore a result from AI tasks" path can be
// checked without spending image-provider credit. Run through the guard:
//   ./scripts/local-env.sh npx ts-node scripts/seed-local-image-task.ts
import { PrismaClient } from "@prisma/client";
import { crc32, deflateSync } from "zlib";

const TEST_USER_EMAIL = "agent-test@xemora.local";
const SEED_PROMPT = "Seeded sample: four colour squares";
const IMAGE_SIZE = 64;
const COLOURS: [number, number, number][] = [
  [220, 38, 38],
  [37, 99, 235],
  [22, 163, 74],
  [234, 179, 8],
];

const prisma = new PrismaClient();

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

// A solid-colour PNG as a data URI, the same shape the image service returns.
function solidPngDataUri([red, green, blue]: [number, number, number]): string {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(IMAGE_SIZE, 0);
  header.writeUInt32BE(IMAGE_SIZE, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(IMAGE_SIZE).fill([red, green, blue]).flat())]);
  const pixels = Buffer.concat(Array(IMAGE_SIZE).fill(row));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function seedImageTask(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
  if (!user) throw new Error(`Run seed-local-users.ts first: ${TEST_USER_EMAIL} does not exist`);

  const metadata = JSON.stringify({ prompt: SEED_PROMPT, images: COLOURS.map(solidPngDataUri) });
  const now = new Date();
  const existing = await prisma.task.findFirst({
    where: { userId: user.id, feature: "image_generation", metadata: { contains: SEED_PROMPT } },
  });

  const data = { status: "completed", progress: 100, metadata, completedAt: now, archivedAt: null };
  const task = existing
    ? await prisma.task.update({ where: { id: existing.id }, data })
    : await prisma.task.create({ data: { userId: user.id, feature: "image_generation", ...data } });
  console.log(`Seeded image task ${task.id} for ${TEST_USER_EMAIL}`);
}

seedImageTask()
  .catch((error) => {
    console.error("Seeding the image task failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
