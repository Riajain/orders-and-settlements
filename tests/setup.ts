import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { unlinkSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.join(process.cwd(), "prisma", "test.db");
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

try {
  unlinkSync(TEST_DB_PATH);
} catch {
  // no-op if file doesn't exist
}

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "ignore",
  env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
});

export const testPrisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB_PATH}` } },
});

export async function resetDatabase() {
  await testPrisma.payment.deleteMany();
  await testPrisma.lineItem.deleteMany();
  await testPrisma.order.deleteMany();
  await testPrisma.user.deleteMany();
}
