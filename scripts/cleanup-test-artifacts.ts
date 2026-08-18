/**
 * Hard-delete confirmed AUTH/TEMP test artifacts from the inventory.
 * Run: npx tsx scripts/cleanup-test-artifacts.ts
 */
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: `file:${path.join(process.cwd(), "prisma", "dev.db")}`,
});
const prisma = new PrismaClient({ adapter });

function isArtifactName(name: string): boolean {
  const n = name.toUpperCase();
  return (
    n.startsWith("AUTH-TEST") ||
    n.startsWith("AUTH-TEMP") ||
    n.startsWith("TEMP ") ||
    n === "TADM" ||
    n === "TMAN" ||
    n === "TSTA" ||
    n === "TVIE"
  );
}

async function main() {
  const [categories, models, customers, assets] = await Promise.all([
    prisma.categoryType.findMany({
      select: { id: true, name: true, code: true },
    }),
    prisma.assetModel.findMany({ select: { id: true, name: true } }),
    prisma.customer.findMany({ select: { id: true, name: true } }),
    prisma.customerAsset.findMany({
      select: { id: true, serialNumber: true },
    }),
  ]);

  const delAssets = assets.filter((r) => isArtifactName(r.serialNumber));
  const delCustomers = customers.filter((r) => isArtifactName(r.name));
  const delModels = models.filter((r) => isArtifactName(r.name));
  const delCats = categories.filter(
    (r) => isArtifactName(r.name) || isArtifactName(r.code)
  );

  const before = {
    categories: await prisma.categoryType.count(),
    assetModels: await prisma.assetModel.count(),
    customers: await prisma.customer.count(),
    customerAssets: await prisma.customerAsset.count(),
  };

  // FK-safe order
  const assetResult = await prisma.customerAsset.deleteMany({
    where: { id: { in: delAssets.map((r) => r.id) } },
  });
  const customerResult = await prisma.customer.deleteMany({
    where: { id: { in: delCustomers.map((r) => r.id) } },
  });
  const modelResult = await prisma.assetModel.deleteMany({
    where: { id: { in: delModels.map((r) => r.id) } },
  });
  const catResult = await prisma.categoryType.deleteMany({
    where: { id: { in: delCats.map((r) => r.id) } },
  });

  // Restore real categories that were soft-archived by auth test users
  // (not hard-deleted — these are migrated catalogue rows)
  const restoredCats = await prisma.categoryType.updateMany({
    where: {
      isActive: false,
      updatedBy: { in: ["Admin User", "Manager User"] },
      NOT: [
        { name: { startsWith: "Temp " } },
        { name: { startsWith: "AUTH-" } },
        { code: { in: ["TADM", "TMAN", "TSTA", "TVIE"] } },
      ],
    },
    data: { isActive: true },
  });

  const after = {
    categories: await prisma.categoryType.count(),
    categoriesActive: await prisma.categoryType.count({
      where: { isActive: true },
    }),
    assetModels: await prisma.assetModel.count(),
    assetModelsActive: await prisma.assetModel.count({
      where: { status: "Active" },
    }),
    customers: await prisma.customer.count(),
    customerAssets: await prisma.customerAsset.count(),
  };

  const remaining = {
    categories: (
      await prisma.categoryType.findMany({
        where: {
          OR: [
            { name: { startsWith: "AUTH-" } },
            { name: { startsWith: "Temp " } },
            { code: { in: ["TADM", "TMAN", "TSTA", "TVIE"] } },
          ],
        },
      })
    ).map((r) => r.name),
    assetModels: (
      await prisma.assetModel.findMany({
        where: { name: { startsWith: "AUTH-" } },
      })
    ).map((r) => r.name),
    customers: (
      await prisma.customer.findMany({
        where: {
          OR: [
            { name: { startsWith: "AUTH-" } },
            { name: { startsWith: "Temp " } },
          ],
        },
      })
    ).map((r) => r.name),
    customerAssets: (
      await prisma.customerAsset.findMany({
        where: { serialNumber: { startsWith: "AUTH-" } },
      })
    ).map((r) => r.serialNumber),
  };

  console.log(
    JSON.stringify(
      {
        deleted: {
          customerAssets: {
            count: assetResult.count,
            items: delAssets.map((r) => r.serialNumber),
          },
          customers: {
            count: customerResult.count,
            items: delCustomers.map((r) => r.name),
          },
          assetModels: {
            count: modelResult.count,
            items: delModels.map((r) => r.name),
          },
          categories: {
            count: catResult.count,
            items: delCats.map((r) => `${r.name} (${r.code})`),
          },
        },
        restoredRealCategoriesArchivedByAuthUsers: restoredCats.count,
        before,
        after,
        remainingSynthetic: remaining,
        baselineOk: {
          categories11: after.categories === 11,
          models251: after.assetModels === 251,
          noSyntheticLeft:
            remaining.categories.length === 0 &&
            remaining.assetModels.length === 0 &&
            remaining.customers.length === 0 &&
            remaining.customerAssets.length === 0,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
