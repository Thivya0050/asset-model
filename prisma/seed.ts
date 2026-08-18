/**
 * Seed script — realistic sample data for first run.
 * Run: npm run db:seed
 *
 * NOTE: This wipes Categories / Models / Customers / Customer Assets.
 * For login users only (keeps real migrated data), run: npm run db:seed-users
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import path from "path";
import { spawnSync } from "child_process";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const SEED_USER = "Admin User";

async function main() {
  console.log("Seeding Asset Model database...");

  await prisma.customerAsset.deleteMany();
  await prisma.assetModel.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.categoryType.deleteMany();

  const customerNames = [
    "AEON QUEENSBAY MALL",
    "MEI GROCER",
    "FreshMart KLCC",
    "FreshMart PJ",
    "DailyMart Subang",
    "HyperValue Penang",
  ];

  const customers = await Promise.all(
    customerNames.map((name) =>
      prisma.customer.create({
        data: { name, status: "Active", updatedBy: SEED_USER },
      })
    )
  );

  const byName = Object.fromEntries(customers.map((c) => [c.name, c]));

  const categories = await Promise.all(
    [
      { name: "Weighing Scale", code: "SCL" },
      { name: "Electronic Shelf Label", code: "ESL" },
      { name: "Refrigeration", code: "REF" },
      { name: "Checkout Counter", code: "CHK" },
    ].map(({ name, code }) =>
      prisma.categoryType.create({
        data: { name, code, updatedBy: SEED_USER },
      })
    )
  );

  const [weighing, esl, refrigeration, checkout] = categories;

  const models = await Promise.all([
    prisma.assetModel.create({
      data: {
        name: "DIGI SM5300X (P) (30KG)",
        categoryTypeId: weighing.id,
        manufacturer: "DIGI",
        description: "Checkout weighing scale with printer, 30kg capacity.",
        defaultWarrantyMonths: 12,
        defaultStampingMonths: 12,
        unitCost: 1850,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "CAS PD-II (15KG)",
        categoryTypeId: weighing.id,
        manufacturer: "CAS",
        description: "Compact portion scale for deli counters.",
        defaultWarrantyMonths: 12,
        defaultStampingMonths: 12,
        unitCost: 620,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "METTLER TOLEDO bCSi (60KG)",
        categoryTypeId: weighing.id,
        manufacturer: "Mettler Toledo",
        defaultWarrantyMonths: 24,
        defaultStampingMonths: 12,
        unitCost: 3200,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "AVERY BERKEL L115 (Legacy)",
        categoryTypeId: weighing.id,
        manufacturer: "Avery Berkel",
        description: "Legacy model — archived for reference only.",
        defaultWarrantyMonths: 12,
        status: "Inactive",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "SES-IMAGOTAG VUSION 2.6in",
        categoryTypeId: esl.id,
        manufacturer: "SES-imagotag",
        defaultWarrantyMonths: 36,
        unitCost: 18.5,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "PRICER SMARTTAG HD 4.2in",
        categoryTypeId: esl.id,
        manufacturer: "Pricer",
        defaultWarrantyMonths: 36,
        unitCost: 22,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "SOLUM NEWTON 2.9in",
        categoryTypeId: esl.id,
        manufacturer: "Solum",
        unitCost: 16,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "CARRIER MULTIDECK 2.5M",
        categoryTypeId: refrigeration.id,
        manufacturer: "Carrier",
        description: "Open multideck dairy cabinet, 2.5m.",
        defaultWarrantyMonths: 24,
        unitCost: 9800,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "HUSSMANN IMPACT REACH-IN",
        categoryTypeId: refrigeration.id,
        manufacturer: "Hussmann",
        defaultWarrantyMonths: 24,
        unitCost: 5400,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "FRIGIDAIRE FREEZER CHEST 500L",
        categoryTypeId: refrigeration.id,
        manufacturer: "Frigidaire",
        unitCost: 2100,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "NCR FASTLANE SELFCHECK 6",
        categoryTypeId: checkout.id,
        manufacturer: "NCR",
        description: "Self-checkout lane with bagging area.",
        defaultWarrantyMonths: 36,
        unitCost: 12500,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "TOSHIBA SUREPOS 700 COUNTER",
        categoryTypeId: checkout.id,
        manufacturer: "Toshiba",
        defaultWarrantyMonths: 24,
        unitCost: 4200,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
    prisma.assetModel.create({
      data: {
        name: "DIEBOLD NIXDORF BEETLE /iPOS",
        categoryTypeId: checkout.id,
        manufacturer: "Diebold Nixdorf",
        unitCost: 3900,
        status: "Active",
        updatedBy: SEED_USER,
      },
    }),
  ]);

  const digi = models[0];
  const cas = models[1];
  const ses = models[4];
  const carrier = models[7];
  const ncr = models[10];

  await prisma.customerAsset.createMany({
    data: [
      {
        serialNumber: "WS-DIGI-00124",
        assetModelId: digi.id,
        categoryTypeId: weighing.id,
        customerId: byName["FreshMart KLCC"].id,
        assetStatus: "InUse",
        warrantyExpiryDate: new Date("2027-03-15"),
        stampingExpiryDate: new Date("2026-09-01"),
        updatedBy: SEED_USER,
      },
      {
        serialNumber: "WS-DIGI-00125",
        assetModelId: digi.id,
        categoryTypeId: weighing.id,
        customerId: byName["FreshMart PJ"].id,
        assetStatus: "InUse",
        warrantyExpiryDate: new Date("2027-04-01"),
        stampingExpiryDate: new Date("2026-10-12"),
        updatedBy: SEED_USER,
      },
      {
        serialNumber: "WS-CAS-00891",
        assetModelId: cas.id,
        categoryTypeId: weighing.id,
        customerId: byName["DailyMart Subang"].id,
        assetStatus: "InStorage",
        warrantyExpiryDate: new Date("2026-12-01"),
        updatedBy: SEED_USER,
      },
      {
        serialNumber: "ESL-SES-44021",
        assetModelId: ses.id,
        categoryTypeId: esl.id,
        customerId: byName["AEON QUEENSBAY MALL"].id,
        assetStatus: "InUse",
        warrantyExpiryDate: new Date("2028-06-30"),
        updatedBy: SEED_USER,
      },
      {
        serialNumber: "RF-CAR-0033",
        assetModelId: carrier.id,
        categoryTypeId: refrigeration.id,
        customerId: byName["HyperValue Penang"].id,
        assetStatus: "InUse",
        warrantyExpiryDate: new Date("2028-01-20"),
        stampingExpiryDate: null,
        updatedBy: SEED_USER,
      },
      {
        serialNumber: "CO-NCR-1008",
        assetModelId: ncr.id,
        categoryTypeId: checkout.id,
        customerId: byName["MEI GROCER"].id,
        assetStatus: "InUse",
        warrantyExpiryDate: new Date("2027-11-15"),
        updatedBy: SEED_USER,
      },
      {
        serialNumber: "CO-NCR-1009",
        assetModelId: ncr.id,
        categoryTypeId: checkout.id,
        customerId: byName["DailyMart Subang"].id,
        assetStatus: "Retired",
        warrantyExpiryDate: new Date("2025-08-01"),
        updatedBy: SEED_USER,
      },
    ],
  });

  console.log(
    `Seeded ${customers.length} customers, ${categories.length} categories, ${models.length} models, 7 customer assets.`
  );

  console.log("\nSeeding login users…");
  const usersResult = spawnSync("npx", ["tsx", "prisma/seed-users.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
  if (usersResult.status !== 0) {
    throw new Error("seed-users failed");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
