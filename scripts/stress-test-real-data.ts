/**
 * Real-data stress checks against live API (port 3001).
 * Run: npx tsx scripts/stress-test-real-data.ts
 */
import "dotenv/config";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { formatCategoryLabel } from "../src/lib/category";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };

async function timedFetch(url: string) {
  const t0 = performance.now();
  const res = await fetch(url);
  const ms = Math.round(performance.now() - t0);
  const body = await res.json();
  return { res, body, ms };
}

async function main() {
  const checks: Check[] = [];

  const cats = await prisma.categoryType.findMany({ orderBy: { name: "asc" } });
  console.log("\n=== Categories in DB (Name / Code) ===");
  for (const c of cats) {
    console.log(
      `  ${formatCategoryLabel(c.name, c.code)}  [name="${c.name}" code="${c.code}"]`
    );
  }

  const weighing = cats.find((c) => c.name === "Weighing Scale" && c.code === "SCL");
  const pos = cats.find((c) => c.name === "POS & APP");
  const cart = cats.find((c) => c.name === "Cart Manager");
  const autoGate = cats.find((c) => c.name === "Auto Gate");
  const checkout = cats.find((c) => c.name === "Checkout Counter");

  // ---- 1. Filter Weighing Scale ----
  {
    if (!weighing) {
      checks.push({
        name: "Filter Asset Models by Weighing Scale (93)",
        status: "FAIL",
        detail: "Weighing Scale (SCL) category not found",
      });
    } else {
      const url = `${BASE}/api/asset-models?categoryTypeId=${weighing.id}&page=1&pageSize=25&sort=name&order=asc`;
      const { body, ms, res } = await timedFetch(url);
      const page2 = await timedFetch(
        `${BASE}/api/asset-models?categoryTypeId=${weighing.id}&page=2&pageSize=25&sort=name&order=asc`
      );
      const ok =
        res.ok &&
        body.total === 93 &&
        (body.rows?.length ?? 0) === 25 &&
        page2.body.total === 93 &&
        (page2.body.rows?.length ?? 0) === 25 &&
        page2.body.page === 2;
      checks.push({
        name: "Filter Asset Models by Weighing Scale (93)",
        status: ok ? "PASS" : "FAIL",
        detail: `total=${body.total} page1Rows=${body.rows?.length} page2Rows=${page2.body.rows?.length} page1Ms=${ms} page2Ms=${page2.ms}`,
      });
    }
  }

  // ---- 2. Search DIGI SM5300X ----
  {
    const { body, ms, res } = await timedFetch(
      `${BASE}/api/asset-models?search=${encodeURIComponent("DIGI SM5300X")}&page=1&pageSize=25`
    );
    const names = (body.rows ?? []).map((r: { name: string }) => r.name);
    const allMatch = names.every((n: string) =>
      n.toUpperCase().includes("DIGI SM5300X")
    );
    const ok = res.ok && body.total >= 1 && names.length >= 1 && allMatch;
    checks.push({
      name: 'Search Asset Models for "DIGI SM5300X"',
      status: ok ? "PASS" : "FAIL",
      detail: `total=${body.total} ms=${ms} names=${JSON.stringify(names)}`,
    });
  }

  // ---- 3. Sort by Model Name ----
  {
    const { body, ms, res } = await timedFetch(
      `${BASE}/api/asset-models?sort=name&order=asc&page=1&pageSize=10`
    );
    const names: string[] = (body.rows ?? []).map((r: { name: string }) => r.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    const ok = res.ok && names.length === 10 && names.every((n, i) => n === sorted[i]);
    checks.push({
      name: "Sort Asset Models by Model Name (asc)",
      status: ok ? "PASS" : "FAIL",
      detail: `ms=${ms} first5=${JSON.stringify(names.slice(0, 5))}`,
    });
  }

  // ---- 4. Sort by Updated On — expect migrated dates, not all today ----
  {
    const { body, ms, res } = await timedFetch(
      `${BASE}/api/asset-models?sort=updatedAt&order=asc&page=1&pageSize=10`
    );
    const dates: string[] = (body.rows ?? []).map(
      (r: { updatedAt: string }) => r.updatedAt
    );
    const parsed = dates.map((d) => new Date(d));
    const ascending = parsed.every(
      (d, i) => i === 0 || d.getTime() >= parsed[i - 1].getTime()
    );
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const notAllToday = parsed.some((d) => {
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return ymd !== todayYmd;
    });
    const sample = dates.slice(0, 3).map((d) => d.slice(0, 10));
    const ok = res.ok && ascending && notAllToday;
    checks.push({
      name: "Sort Asset Models by Updated On (migrated dates)",
      status: ok ? "PASS" : "FAIL",
      detail: `ms=${ms} ascending=${ascending} notAllToday=${notAllToday} sampleDates=${JSON.stringify(sample)}`,
    });
  }

  // ---- 5. Export filtered Weighing Scale = 93 rows ----
  {
    if (!weighing) {
      checks.push({
        name: "Export Weighing Scale filtered = 93 rows",
        status: "FAIL",
        detail: "category missing",
      });
    } else {
      // Mirror UI export: pageSize 100 with filter (93 < 100 so full set)
      const { body, ms, res } = await timedFetch(
        `${BASE}/api/asset-models?categoryTypeId=${weighing.id}&page=1&pageSize=100&sort=name&order=asc`
      );
      const ok =
        res.ok && body.total === 93 && (body.rows?.length ?? 0) === 93;
      checks.push({
        name: "Export Weighing Scale filtered = 93 rows",
        status: ok ? "PASS" : "FAIL",
        detail: `total=${body.total} exportRows=${body.rows?.length} ms=${ms} (not all 251)`,
      });
    }
  }

  // ---- 6. Category dropdown: all 11 as Name (Code) ----
  {
    const { body, ms, res } = await timedFetch(`${BASE}/api/category-types`);
    const list = Array.isArray(body) ? body : (body.rows ?? body.data ?? []);
    const labels = list.map(
      (c: { name: string; code?: string; label?: string }) =>
        c.label ?? formatCategoryLabel(c.name, c.code)
    );
    const allFormatted = labels.every(
      (l: string) => /\(.+\)/.test(l) && !l.startsWith("(")
    );
    const ok = res.ok && list.length === 11 && allFormatted;
    checks.push({
      name: "Category filter dropdown shows all 11 as Name (Code)",
      status: ok ? "PASS" : "FAIL",
      detail: `count=${list.length} ms=${ms} labels=${JSON.stringify(labels)}`,
    });
  }

  // ---- 7. Small categories ----
  async function smallCat(
    label: string,
    cat: { id: string; name: string; code: string } | undefined,
    expected: number
  ) {
    if (!cat) {
      checks.push({
        name: `Small category: ${label} (${expected})`,
        status: "FAIL",
        detail: "category not found",
      });
      return;
    }
    const { body, ms, res } = await timedFetch(
      `${BASE}/api/asset-models?categoryTypeId=${cat.id}&page=1&pageSize=25`
    );
    const ok =
      res.ok && body.total === expected && (body.rows?.length ?? 0) === expected;
    checks.push({
      name: `Small category: ${formatCategoryLabel(cat.name, cat.code)} (${expected})`,
      status: ok ? "PASS" : "FAIL",
      detail: `total=${body.total} rows=${body.rows?.length} ms=${ms}`,
    });
  }

  await smallCat("POS & APP", pos, 1);
  await smallCat("Cart Manager", cart, 1);
  await smallCat("Auto Gate", autoGate, 2);
  await smallCat("Checkout Counter", checkout, 2);

  console.log("\n===== STRESS TEST RESULTS =====");
  for (const c of checks) {
    console.log(`[${c.status}] ${c.name}`);
    console.log(`         ${c.detail}`);
  }
  const failed = checks.filter((c) => c.status === "FAIL").length;
  console.log(
    `\nSummary: ${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`
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
