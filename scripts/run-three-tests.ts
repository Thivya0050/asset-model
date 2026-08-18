/**
 * Manual integration tests against running app + DB.
 * Run: npx tsx scripts/run-three-tests.ts
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import path from "path";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

type Result = { name: string; status: "PASS" | "FAIL" | "PARTIAL"; detail: string };

const results: Result[] = [];

function record(name: string, status: Result["status"], detail: string) {
  results.push({ name, status, detail });
  console.log(`\n[${status}] ${name}\n  ${detail}`);
}

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function test1() {
  console.log("\n========== TEST 1: Bulk Import Validation ==========");

  const weighing = await prisma.categoryType.findFirst({
    where: { name: "Weighing Scale", isActive: true },
  });
  if (!weighing) {
    record("TEST 1", "FAIL", "No active 'Weighing Scale' category in DB — cannot run.");
    return;
  }

  const existing = await prisma.assetModel.findFirst({
    where: { categoryTypeId: weighing.id, status: "Active" },
  });
  if (!existing) {
    record("TEST 1", "FAIL", "No active model in Weighing Scale to use as duplicate.");
    return;
  }

  const uniqueName = `TEST IMPORT MODEL ${Date.now()}`;
  const rows = [
    {
      name: uniqueName,
      category: "Weighing Scale",
      manufacturer: "TestCo",
      description: "Valid import row",
      defaultWarrantyMonths: "12",
      defaultStampingMonths: "12",
      unitCost: "100",
    },
    {
      name: "TEST BAD CATEGORY MODEL",
      category: "Weighin Scale",
      manufacturer: "TestCo",
    },
    {
      name: existing.name,
      category: "Weighing Scale",
      manufacturer: "Dup",
    },
  ];

  console.log("Validating rows via POST /api/import mode=validate …");
  console.log("  Row1:", uniqueName, "+ Weighing Scale");
  console.log("  Row2: misspelled category Weighin Scale");
  console.log("  Row3: duplicate of", existing.name);

  const { res: vRes, body: vBody } = await json(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "asset-models",
      mode: "validate",
      rows,
      updatedBy: "Test Runner",
    }),
  });

  if (!vRes.ok) {
    record("TEST 1 validate", "FAIL", `Validate HTTP ${vRes.status}: ${JSON.stringify(vBody)}`);
    return;
  }

  const validated = vBody.rows as Array<{
    rowIndex: number;
    status: string;
    message?: string;
  }>;
  const summary = vBody.summary;
  console.log("Summary:", summary);
  for (const r of validated) {
    console.log(
      `  Row ${r.rowIndex + 1}: status=${r.status} message=${r.message ?? "(none)"}`
    );
  }

  const row1 = validated.find((r) => r.rowIndex === 0);
  const row2 = validated.find((r) => r.rowIndex === 1);
  const row3 = validated.find((r) => r.rowIndex === 2);

  const row1Ok = row1?.status === "ok";
  const row2Err =
    row2?.status === "error" &&
    Boolean(row2.message?.includes("Weighin Scale")) &&
    Boolean(row2.message?.toLowerCase().includes("not found"));
  const row3Dup = row3?.status === "duplicate";

  console.log("Checks: row1 ok?", row1Ok, "row2 error w/ name?", row2Err, "row3 duplicate?", row3Dup);

  const beforeCount = await prisma.assetModel.count({
    where: { name: uniqueName },
  });

  console.log("Committing with includeDuplicates=false (only ready rows) …");
  const { res: cRes, body: cBody } = await json(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "asset-models",
      mode: "commit",
      rows,
      updatedBy: "Test Runner",
      includeDuplicates: false,
    }),
  });

  if (!cRes.ok) {
    record("TEST 1 commit", "FAIL", `Commit HTTP ${cRes.status}: ${JSON.stringify(cBody)}`);
    return;
  }

  console.log("Commit result:", {
    imported: cBody.imported,
    skipped: cBody.skipped,
  });

  const after = await prisma.assetModel.findMany({
    where: { name: uniqueName },
  });
  const badCat = await prisma.assetModel.findMany({
    where: { name: "TEST BAD CATEGORY MODEL" },
  });

  console.log("DB: uniqueName count=", after.length, "bad category model count=", badCat.length);
  console.log("beforeCount was", beforeCount);

  const createdOne = after.length === beforeCount + 1 && after.length === 1;
  const noBad = badCat.length === 0;
  const importedOne = cBody.imported === 1;

  if (row1Ok && row2Err && row3Dup && createdOne && noBad && importedOne) {
    record(
      "TEST 1 — Bulk Import Validation",
      "PASS",
      `Preview: ready/error/duplicate as expected. Commit imported=${cBody.imported}, skipped=${cBody.skipped}; DB has exactly 1 new model '${uniqueName}'.`
    );
  } else {
    record(
      "TEST 1 — Bulk Import Validation",
      "FAIL",
      `row1Ok=${row1Ok} row2Err=${row2Err} (msg=${row2?.message}) row3Dup=${row3Dup} imported=${cBody.imported} dbUnique=${after.length} dbBad=${badCat.length}`
    );
  }

  // cleanup test model
  await prisma.assetModel.deleteMany({ where: { name: uniqueName } });
}

async function test2() {
  console.log("\n========== TEST 2: Archive Model With Dependent Assets ==========");

  const modelWithAssets = await prisma.assetModel.findFirst({
    where: { status: "Active", customerAssets: { some: {} } },
    include: {
      customerAssets: { take: 3 },
      categoryType: true,
      _count: { select: { customerAssets: true } },
    },
  });

  if (!modelWithAssets) {
    record("TEST 2", "FAIL", "No active Asset Model with Customer Assets found.");
    return;
  }

  console.log(
    `Using model: ${modelWithAssets.name} (${modelWithAssets._count.customerAssets} assets)`
  );
  const assetId = modelWithAssets.customerAssets[0]?.id;
  console.log("Sample dependent asset id:", assetId);

  const { res: delRes, body: delBody } = await json(
    `${BASE}/api/asset-models/${modelWithAssets.id}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updatedBy: "Test Runner" }),
    }
  );
  console.log("Archive response:", delRes.status, delBody?.status ?? delBody);

  const archiveOk = delRes.ok && (delBody.status === "Inactive" || true);
  const refreshed = await prisma.assetModel.findUnique({
    where: { id: modelWithAssets.id },
  });
  console.log("DB status after archive:", refreshed?.status);

  // List API — should show Inactive
  const { body: listBody } = await json(
    `${BASE}/api/asset-models?status=Inactive&pageSize=100&search=${encodeURIComponent(modelWithAssets.name)}`
  );
  const inArchivedList = (listBody.rows ?? []).some(
    (r: { id: string; status: string }) =>
      r.id === modelWithAssets.id && r.status === "Inactive"
  );
  console.log("Appears in Inactive list?", inArchivedList);

  // Active dropdown source used by Customer Assets form
  const { body: activeModels } = await json(
    `${BASE}/api/asset-models?status=Active&pageSize=100`
  );
  const inActiveDropdown = (activeModels.rows ?? []).some(
    (r: { id: string }) => r.id === modelWithAssets.id
  );
  console.log("Still in Active models API (dropdown)?", inActiveDropdown);

  // Dependent assets still readable
  const { res: assetRes, body: assetBody } = await json(
    `${BASE}/api/customer-assets/${assetId}`
  );
  console.log("Dependent asset GET:", assetRes.status, {
    serial: assetBody.serialNumber,
    modelName: assetBody.assetModel?.name,
    categoryName: assetBody.categoryType?.name,
    customerName: assetBody.customer?.name,
  });

  const assetDisplayOk =
    assetRes.ok &&
    assetBody.assetModel?.name === modelWithAssets.name &&
    Boolean(assetBody.categoryType?.name) &&
    Boolean(assetBody.customer?.name);

  // Edit (PUT) without changing model — should succeed
  const { res: putRes, body: putBody } = await json(
    `${BASE}/api/customer-assets/${assetId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serialNumber: assetBody.serialNumber,
        assetModelId: assetBody.assetModelId,
        customerId: assetBody.customerId,
        assetStatus:
          assetBody.assetStatus === "InStorage"
            ? "In Storage"
            : assetBody.assetStatus === "Retired"
              ? "Retired"
              : "In Use",
        warrantyExpiryDate: assetBody.warrantyExpiryDate,
        stampingExpiryDate: assetBody.stampingExpiryDate,
        updatedBy: "Test Runner",
      }),
    }
  );
  console.log("Edit dependent asset PUT:", putRes.status, putBody.error ?? "ok");

  // Restore model to Active for cleanliness
  await prisma.assetModel.update({
    where: { id: modelWithAssets.id },
    data: { status: "Active", updatedBy: "Test Runner" },
  });
  console.log("Restored model to Active after test.");

  const allGood =
    delRes.ok &&
    refreshed?.status === "Inactive" &&
    inArchivedList &&
    !inActiveDropdown &&
    assetDisplayOk &&
    putRes.ok;

  if (allGood) {
    record(
      "TEST 2 — Archive with dependents",
      "PASS",
      `Archived '${modelWithAssets.name}' → Inactive; hidden from Active dropdown; asset '${assetBody.serialNumber}' still shows model/category/customer; PUT edit succeeded.`
    );
  } else {
    record(
      "TEST 2 — Archive with dependents",
      "FAIL",
      `archiveOk=${delRes.ok} dbInactive=${refreshed?.status} inArchivedList=${inArchivedList} inActiveDropdown=${inActiveDropdown} assetDisplayOk=${assetDisplayOk} putOk=${putRes.ok} putErr=${putBody.error}`
    );
  }
}

async function test3() {
  console.log("\n========== TEST 3: Empty Search / No Results ==========");

  const nonsense = "zzqxnotreal";

  const { res: mRes, body: mBody } = await json(
    `${BASE}/api/asset-models?search=${encodeURIComponent(nonsense)}&page=1&pageSize=10`
  );
  console.log("Asset Models search:", mRes.status, {
    total: mBody.total,
    rows: mBody.rows?.length,
  });

  const { res: aRes, body: aBody } = await json(
    `${BASE}/api/customer-assets?serial=${encodeURIComponent(nonsense)}`
  );
  console.log("Customer Assets search:", aRes.status, {
    count: Array.isArray(aBody) ? aBody.length : "not-array",
  });

  // Clear search — full list
  const { body: mAll } = await json(
    `${BASE}/api/asset-models?page=1&pageSize=10`
  );
  const { body: aAll } = await json(`${BASE}/api/customer-assets`);
  console.log("Cleared Asset Models total:", mAll.total);
  console.log("Cleared Customer Assets count:", Array.isArray(aAll) ? aAll.length : aAll);

  const modelsEmpty =
    mRes.ok && mBody.total === 0 && Array.isArray(mBody.rows) && mBody.rows.length === 0;
  const assetsEmpty =
    aRes.ok && Array.isArray(aBody) && aBody.length === 0;
  const modelsRestored = (mAll.total ?? 0) > 0;
  const assetsRestored = Array.isArray(aAll) && aAll.length > 0;

  // UI empty-state copy — verify source contains friendly messages
  const fs = await import("fs");
  const modelsPage = fs.readFileSync(
    path.join(process.cwd(), "src/app/asset-models/page.tsx"),
    "utf8"
  );
  const assetsPage = fs.readFileSync(
    path.join(process.cwd(), "src/app/customer-assets/page.tsx"),
    "utf8"
  );
  const modelsMsgOk = modelsPage.includes("No models match the current filters.");
  const assetsMsgOk = assetsPage.includes(
    "No customer assets match the current filters."
  );
  console.log("UI empty messages present?", { modelsMsgOk, assetsMsgOk });

  if (
    modelsEmpty &&
    assetsEmpty &&
    modelsRestored &&
    assetsRestored &&
    modelsMsgOk &&
    assetsMsgOk
  ) {
    record(
      "TEST 3 — Empty search / no results",
      "PASS",
      `API returns 0 rows for '${nonsense}' on both lists; clearing restores data (models total=${mAll.total}, assets=${aAll.length}). UI shows friendly filter-empty copy on both pages.`
    );
  } else if (modelsEmpty && assetsEmpty && modelsRestored && assetsRestored) {
    record(
      "TEST 3 — Empty search / no results",
      "PARTIAL",
      `API empty+restore OK, but UI message check failed (modelsMsgOk=${modelsMsgOk} assetsMsgOk=${assetsMsgOk}).`
    );
  } else {
    record(
      "TEST 3 — Empty search / no results",
      "FAIL",
      `modelsEmpty=${modelsEmpty} assetsEmpty=${assetsEmpty} modelsRestored=${modelsRestored} assetsRestored=${assetsRestored}`
    );
  }
}

async function main() {
  console.log("Base URL:", BASE);
  console.log("DB:", dbPath);
  await test1();
  await test2();
  await test3();
  console.log("\n========== SUMMARY ==========");
  for (const r of results) {
    console.log(`${r.status.padEnd(7)} ${r.name}: ${r.detail}`);
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
