/**
 * End-to-end real data migration: Categories then Asset Models.
 * Uses POST /api/import with migrationMode (same path as the UI).
 *
 * Run: npx tsx scripts/migrate-real-data.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  formatCategoryLabel,
  parseCategoryLabel,
} from "../src/lib/category";
import { fetchSessionCookie } from "./auth-session";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const ADMIN_EMAIL = process.env.MIGRATE_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.MIGRATE_PASSWORD ?? "Password123!";
const CATEGORY_FILE =
  process.env.CATEGORY_XLSX ??
  path.join("C:", "Users", "tech1", "Downloads", "Catergory_Type.xlsx");
const MODEL_FILE =
  process.env.MODEL_XLSX ??
  path.join("C:", "Users", "tech1", "Downloads", "Asset_model.xlsx");

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

let sessionCookie = "";

function cellToString(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date (days since 1899-12-30)
    if (v > 20000 && v < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const dt = new Date(epoch.getTime() + v * 86400000);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}/${m}/${d}`;
    }
    return String(v);
  }
  return String(v).trim();
}

function readSheet(filePath: string): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error(`No sheets in ${filePath}`);
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const rows = json
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        const key = String(k).trim();
        if (!key) continue;
        out[key] = v;
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()));
  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : ((XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) ?? [])
          .map((h) => String(h ?? "").trim())
          .filter(Boolean);
  return { headers, rows };
}

function pick(row: Record<string, unknown>, ...names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const exact = keys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (exact) return cellToString(row[exact]);
  }
  // fuzzy contains
  for (const name of names) {
    const fuzzy = keys.find((k) =>
      k.toLowerCase().includes(name.toLowerCase())
    );
    if (fuzzy) return cellToString(row[fuzzy]);
  }
  return "";
}

async function callImport(
  entity: string,
  rows: Record<string, string>[]
): Promise<{
  imported: number;
  skipped: number;
  skippedRows: Array<Record<string, unknown>>;
  summary: { ready: number; errors: number; duplicates: number; total: number };
}> {
  // Validate first (same as UI)
  const validateRes = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      entity,
      mode: "validate",
      migrationMode: true,
      rows,
    }),
  });
  const validateBody = await validateRes.json();
  if (!validateRes.ok) {
    throw new Error(
      `Validate failed for ${entity}: ${JSON.stringify(validateBody)}`
    );
  }

  console.log(`  Validate summary:`, validateBody.summary);
  const errors = (validateBody.rows ?? []).filter(
    (r: { status: string }) => r.status === "error"
  );
  if (errors.length) {
    console.log(`  Error rows (${errors.length}):`);
    for (const e of errors.slice(0, 20)) {
      console.log(`    Row ${e.rowIndex + 2}: ${e.message}`);
    }
    if (errors.length > 20) console.log(`    …and ${errors.length - 20} more`);
  }

  const commitRes = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      entity,
      mode: "commit",
      migrationMode: true,
      includeDuplicates: false,
      rows,
    }),
  });
  const commitBody = await commitRes.json();
  if (!commitRes.ok) {
    throw new Error(
      `Commit failed for ${entity}: ${JSON.stringify(commitBody)}`
    );
  }
  return commitBody;
}

async function main() {
  console.log("BASE:", BASE);
  console.log("Logging in as", ADMIN_EMAIL, "…");
  sessionCookie = await fetchSessionCookie(BASE, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated.");
  console.log("Category file:", CATEGORY_FILE);
  console.log("Model file:", MODEL_FILE);

  // ---- STEP 1: Categories ----
  console.log("\n========== STEP 1: Categories ==========");
  const catSheet = readSheet(CATEGORY_FILE);
  console.log("Headers:", catSheet.headers);
  console.log("Rows read:", catSheet.rows.length);
  console.log("Sample row 1:", catSheet.rows[0]);

  // Supports either combined "Name (CODE)" in one column, or separate Name + Code.
  const catRows = catSheet.rows.map((r) => {
    const rawName = pick(r, "Category", "Name", "Category Type");
    const rawCode = pick(r, "Code", "Category Code", "Short Code");
    const parsed = parseCategoryLabel(rawName);
    return {
      name: parsed.name || rawName,
      code: rawCode || parsed.code,
      updatedAt: pick(r, "Update On", "Updated On", "Updated At"),
      updatedBy: pick(r, "Update By", "Updated By"),
    };
  });

  console.log("Mapped sample:", catRows[0]);
  console.log(
    "Mapped labels:",
    catRows.map((r) => formatCategoryLabel(r.name, r.code))
  );
  const catResult = await callImport("categories", catRows);
  console.log("Import result:", {
    imported: catResult.imported,
    skipped: catResult.skipped,
    summary: catResult.summary,
  });

  // ---- STEP 2: Asset Models ----
  console.log("\n========== STEP 2: Asset Models ==========");
  const modelSheet = readSheet(MODEL_FILE);
  console.log("Headers:", modelSheet.headers);
  console.log("Rows read:", modelSheet.rows.length);
  console.log("Sample row 1:", modelSheet.rows[0]);

  const modelRows = modelSheet.rows.map((r) => ({
    name: pick(r, "Model", "Model Name", "Asset Model"),
    category: pick(r, "Category", "Category Type"),
    updatedAt: pick(r, "Update On", "Updated On", "Updated At"),
    updatedBy: pick(r, "Update By", "Updated By"),
  }));

  console.log("Mapped sample:", modelRows[0]);
  const pms10 = modelRows.filter((r) => r.name.trim() === "PMS-10");
  console.log(
    "PMS-10 in source:",
    pms10.map((r) => ({ name: r.name, category: r.category }))
  );

  const modelResult = await callImport("asset-models", modelRows);
  console.log("Import result:", {
    imported: modelResult.imported,
    skipped: modelResult.skipped,
    summary: modelResult.summary,
  });
  if (modelResult.skippedRows?.length) {
    console.log("Skipped sample:", modelResult.skippedRows.slice(0, 10));
  }

  // ---- STEP 3: Verify ----
  console.log("\n========== STEP 3: VERIFY ==========");
  const results: Array<{ check: string; status: "PASS" | "FAIL"; detail: string }> =
    [];

  const catCount = await prisma.categoryType.count();
  const cats = await prisma.categoryType.findMany({ orderBy: { name: "asc" } });
  results.push({
    check: "Categories total = 11",
    status: catCount === 11 ? "PASS" : "FAIL",
    detail: `actual=${catCount}`,
  });

  const sourceCatLabels = catRows
    .map((r) => formatCategoryLabel(r.name, r.code).trim())
    .filter(Boolean);
  const dbCatLabels = new Set(
    cats.map((c) => formatCategoryLabel(c.name, c.code))
  );
  const dbCatNames = new Set(cats.map((c) => c.name));
  const missingCats = sourceCatLabels.filter((n) => !dbCatLabels.has(n));
  const spot = sourceCatLabels.slice(0, 3);
  const spotOk = spot.every((n) => dbCatLabels.has(n));
  const allHaveCode = cats.every((c) => Boolean(c.code?.trim()));
  results.push({
    check: "Category Name+Code labels match source",
    status:
      missingCats.length === 0 && spotOk && allHaveCode ? "PASS" : "FAIL",
    detail: `spot=${JSON.stringify(spot)}; missing=${missingCats.length}; allHaveCode=${allHaveCode}`,
  });

  const modelCount = await prisma.assetModel.count();
  results.push({
    check: "Asset Models total = 251",
    status: modelCount === 251 ? "PASS" : "FAIL",
    detail: `actual=${modelCount}`,
  });

  const models = await prisma.assetModel.findMany({
    include: { categoryType: true },
  });
  const orphan = models.filter((m) => !m.categoryTypeId || !m.categoryType);
  const linkedToImported = models.every((m) =>
    dbCatNames.has(m.categoryType.name)
  );
  results.push({
    check: "Every model links to one of 11 categories (no orphans)",
    status: orphan.length === 0 && linkedToImported ? "PASS" : "FAIL",
    detail: `orphans=${orphan.length}; allLinked=${linkedToImported}`,
  });

  const pms = models.filter((m) => m.name === "PMS-10");
  const pmsCats = [
    ...new Set(
      pms.map((m) =>
        formatCategoryLabel(m.categoryType.name, m.categoryType.code)
      )
    ),
  ];
  results.push({
    check: "PMS-10 exists as exactly 2 records with different categories",
    status: pms.length === 2 && pmsCats.length === 2 ? "PASS" : "FAIL",
    detail: `count=${pms.length}; categories=${JSON.stringify(pmsCats)}`,
  });

  // Spot-check audit fields against source
  let auditMismatches = 0;
  const auditSamples: string[] = [];
  for (const src of modelRows.slice(0, 5)) {
    const srcCat = parseCategoryLabel(src.category.trim());
    const found = models.find(
      (m) =>
        m.name === src.name.trim() &&
        (formatCategoryLabel(m.categoryType.name, m.categoryType.code) ===
          formatCategoryLabel(srcCat.name, srcCat.code) ||
          m.categoryType.name === srcCat.name)
    );
    if (!found) {
      auditMismatches++;
      auditSamples.push(`missing ${src.name} / ${src.category}`);
      continue;
    }
    if (found.updatedBy !== src.updatedBy.trim()) {
      auditMismatches++;
      auditSamples.push(
        `By mismatch ${src.name}: db=${found.updatedBy} src=${src.updatedBy}`
      );
    }
    // Compare date Y/M/D in local time
    const srcDate = src.updatedAt.trim();
    if (srcDate) {
      const m = srcDate.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const ok =
          found.updatedAt.getFullYear() === y &&
          found.updatedAt.getMonth() + 1 === mo &&
          found.updatedAt.getDate() === d;
        if (!ok) {
          auditMismatches++;
          auditSamples.push(
            `On mismatch ${src.name}: db=${found.updatedAt.toISOString()} src=${srcDate}`
          );
        } else {
          auditSamples.push(
            `OK ${src.name}: ${found.updatedBy} @ ${y}/${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}`
          );
        }
      }
    }
  }
  results.push({
    check: "Updated On / Updated By match source (spot-check)",
    status: auditMismatches === 0 ? "PASS" : "FAIL",
    detail: auditSamples.join("; "),
  });

  // Category audit spot-check
  let catAuditFail = 0;
  for (const src of catRows.slice(0, 3)) {
    const found = cats.find(
      (c) =>
        c.name === src.name.trim() &&
        (!src.code || c.code === src.code.trim())
    );
    if (!found || found.updatedBy !== src.updatedBy.trim()) {
      catAuditFail++;
      continue;
    }
    const m = src.updatedAt.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (
        found.updatedAt.getFullYear() !== y ||
        found.updatedAt.getMonth() + 1 !== mo ||
        found.updatedAt.getDate() !== d
      ) {
        catAuditFail++;
      }
    }
  }
  results.push({
    check: "Category Updated On / By match source (spot-check)",
    status: catAuditFail === 0 ? "PASS" : "FAIL",
    detail: `failures=${catAuditFail}; sampleBy=${cats[0]?.updatedBy}; sampleAt=${cats[0]?.updatedAt?.toISOString()}`,
  });

  const statsRes = await fetch(`${BASE}/api/stats`, {
    headers: { Cookie: sessionCookie },
  });
  const stats = await statsRes.json();
  results.push({
    check: "Dashboard: 11 Categories (all Active)",
    status:
      stats.categories?.total === 11 && stats.categories?.active === 11
        ? "PASS"
        : "FAIL",
    detail: JSON.stringify(stats.categories),
  });
  results.push({
    check: "Dashboard: 251 Asset Models (all Active)",
    status:
      stats.models?.total === 251 && stats.models?.active === 251
        ? "PASS"
        : "FAIL",
    detail: JSON.stringify(stats.models),
  });

  console.log("\n----- VERIFICATION -----");
  for (const r of results) {
    console.log(`[${r.status}] ${r.check} — ${r.detail}`);
  }

  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(
    `\nDONE: categories imported=${catResult.imported}/${catRows.length}, models imported=${modelResult.imported}/${modelRows.length}, verify failures=${failed}`
  );
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
