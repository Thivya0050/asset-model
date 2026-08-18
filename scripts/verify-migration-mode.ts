/**
 * Verify wipe + Migration Mode import for Categories and Asset Models.
 * Run: npx tsx scripts/verify-migration-mode.ts
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import path from "path";
import { parseMigrationDate } from "../src/lib/import/schema";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const counts = {
    customerAssets: await prisma.customerAsset.count(),
    assetModels: await prisma.assetModel.count(),
    customers: await prisma.customer.count(),
    categories: await prisma.categoryType.count(),
  };
  console.log("DB counts:", counts);
  if (
    counts.customerAssets !== 0 ||
    counts.assetModels !== 0 ||
    counts.customers !== 0 ||
    counts.categories !== 0
  ) {
    throw new Error("Expected empty DB before migration-mode verify");
  }

  // Date parser smoke checks
  const d1 = parseMigrationDate("2025/04/10");
  const d2 = parseMigrationDate("2026-07-24");
  console.log("parse 2025/04/10 =>", d1?.toISOString());
  console.log("parse 2026-07-24 =>", d2?.toISOString());
  if (!d1 || d1.getFullYear() !== 2025 || d1.getMonth() !== 3 || d1.getDate() !== 10) {
    throw new Error("Failed to parse 2025/04/10");
  }
  if (!d2 || d2.getFullYear() !== 2026 || d2.getMonth() !== 6 || d2.getDate() !== 24) {
    throw new Error("Failed to parse 2026-07-24");
  }

  // Import category with migration fields
  const catRes = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "categories",
      mode: "commit",
      migrationMode: true,
      updatedBy: "Alex Chen (Ops)", // should be ignored when row has updatedBy
      rows: [
        {
          name: "MIG-CAT-Weighing",
          updatedAt: "2025/04/10",
          updatedBy: "DAMON",
        },
      ],
    }),
  });
  const catBody = await catRes.json();
  console.log("Category import:", catRes.status, catBody);
  if (!catRes.ok || catBody.imported !== 1) {
    throw new Error("Category migration import failed");
  }

  const cat = await prisma.categoryType.findFirst({
    where: { name: "MIG-CAT-Weighing" },
  });
  console.log("Category row:", {
    name: cat?.name,
    updatedBy: cat?.updatedBy,
    updatedAt: cat?.updatedAt?.toISOString(),
  });
  if (!cat || cat.updatedBy !== "DAMON") {
    throw new Error(`Expected updatedBy DAMON, got ${cat?.updatedBy}`);
  }
  if (
    !cat.updatedAt ||
    cat.updatedAt.getFullYear() !== 2025 ||
    cat.updatedAt.getMonth() !== 3 ||
    cat.updatedAt.getDate() !== 10
  ) {
    throw new Error(`Expected updatedAt 2025-04-10, got ${cat.updatedAt}`);
  }

  // Import asset model with migration fields
  const modelRes = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "asset-models",
      mode: "commit",
      migrationMode: true,
      updatedBy: "Alex Chen (Ops)",
      rows: [
        {
          name: "MIG-MODEL-DIGI",
          category: "MIG-CAT-Weighing",
          manufacturer: "DIGI",
          updatedAt: "2026/07/24",
          updatedBy: "Sharina",
        },
      ],
    }),
  });
  const modelBody = await modelRes.json();
  console.log("Model import:", modelRes.status, modelBody);
  if (!modelRes.ok || modelBody.imported !== 1) {
    throw new Error("Model migration import failed");
  }

  const model = await prisma.assetModel.findFirst({
    where: { name: "MIG-MODEL-DIGI" },
  });
  console.log("Model row:", {
    name: model?.name,
    updatedBy: model?.updatedBy,
    updatedAt: model?.updatedAt?.toISOString(),
  });
  if (!model || model.updatedBy !== "Sharina") {
    throw new Error(`Expected updatedBy Sharina, got ${model?.updatedBy}`);
  }
  if (
    !model.updatedAt ||
    model.updatedAt.getFullYear() !== 2026 ||
    model.updatedAt.getMonth() !== 6 ||
    model.updatedAt.getDate() !== 24
  ) {
    throw new Error(`Expected updatedAt 2026-07-24, got ${model.updatedAt}`);
  }

  // Invalid date should error in validate
  const bad = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "categories",
      mode: "validate",
      migrationMode: true,
      rows: [{ name: "Bad Date Cat", updatedAt: "not-a-date", updatedBy: "SRI" }],
    }),
  });
  const badBody = await bad.json();
  console.log("Bad date validate:", badBody.summary, badBody.rows?.[0]?.message);
  if (badBody.rows?.[0]?.status !== "error") {
    throw new Error("Expected invalid Updated On to fail validation");
  }

  // Cleanup verification rows so DB stays empty for real migration
  await prisma.assetModel.deleteMany({ where: { name: "MIG-MODEL-DIGI" } });
  await prisma.categoryType.deleteMany({ where: { name: "MIG-CAT-Weighing" } });
  const after = {
    customerAssets: await prisma.customerAsset.count(),
    assetModels: await prisma.assetModel.count(),
    customers: await prisma.customer.count(),
    categories: await prisma.categoryType.count(),
  };
  console.log("Cleaned back to:", after);
  console.log("PASS: Migration Mode works for Categories and Asset Models.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
