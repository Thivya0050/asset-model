/**
 * One-time: split Category "Name (CODE)" into name + code fields.
 * Run after `npx prisma db push` adds the code column.
 *
 *   npx tsx scripts/split-category-name-code.ts
 */
import "dotenv/config";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseCategoryLabel } from "../src/lib/category";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rows = await prisma.categoryType.findMany({ orderBy: { name: "asc" } });
  console.log(`Found ${rows.length} categories\n`);
  console.log("BEFORE → AFTER");

  const results: Array<{
    before: string;
    afterName: string;
    afterCode: string;
  }> = [];

  for (const row of rows) {
    const before = row.name;
    // If already split (code populated and name has no trailing (CODE)), keep
    const parsed =
      row.code && !/\([^)]+\)\s*$/.test(row.name)
        ? { name: row.name.trim(), code: row.code.trim() }
        : parseCategoryLabel(row.name);

    if (!parsed.code) {
      throw new Error(
        `Could not extract code from category "${before}" — aborting`
      );
    }

    await prisma.categoryType.update({
      where: { id: row.id },
      data: { name: parsed.name, code: parsed.code },
    });

    results.push({
      before,
      afterName: parsed.name,
      afterCode: parsed.code,
    });
    console.log(
      `  "${before}"  →  name="${parsed.name}"  code="${parsed.code}"`
    );
  }

  // Verify uniqueness
  const after = await prisma.categoryType.findMany();
  const codes = after.map((c) => c.code);
  const names = after.map((c) => c.name);
  if (new Set(codes).size !== codes.length) {
    throw new Error("Duplicate codes after split");
  }
  if (new Set(names).size !== names.length) {
    throw new Error("Duplicate names after split");
  }
  if (after.some((c) => !c.code || /\([^)]+\)\s*$/.test(c.name))) {
    throw new Error("Some rows still look unsplit");
  }

  console.log(`\nOK: ${results.length} categories split.`);
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
