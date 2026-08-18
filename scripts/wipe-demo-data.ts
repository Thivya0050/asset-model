/**
 * Wipe all demo/seed data from the four entity tables.
 * Run: npx tsx scripts/wipe-demo-data.ts
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function counts() {
  return {
    customerAssets: await prisma.customerAsset.count(),
    assetModels: await prisma.assetModel.count(),
    customers: await prisma.customer.count(),
    categories: await prisma.categoryType.count(),
  };
}

async function main() {
  console.log("DB:", dbPath);
  console.log("BEFORE:", await counts());

  // FK order: dependents first
  await prisma.customerAsset.deleteMany();
  await prisma.assetModel.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.categoryType.deleteMany();

  const after = await counts();
  console.log("AFTER:", after);

  const empty =
    after.customerAssets === 0 &&
    after.assetModels === 0 &&
    after.customers === 0 &&
    after.categories === 0;

  if (!empty) {
    console.error("Wipe incomplete — some tables still have rows.");
    process.exit(1);
  }
  console.log("OK: all four tables empty.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
