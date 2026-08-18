/**
 * Auth + RBAC verification against live API.
 * Run: npx tsx scripts/verify-auth.ts
 */
import "dotenv/config";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { fetchSessionCookie } from "./auth-session";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const PASSWORD = "Password123!";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

type Check = { name: string; status: "PASS" | "FAIL"; detail: string };

async function api(
  cookie: string | null,
  method: string,
  urlPath: string,
  body?: unknown
) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, location: res.headers.get("location") };
}

async function main() {
  const checks: Check[] = [];

  // Data untouched
  const catCount = await prisma.categoryType.count();
  const modelCount = await prisma.assetModel.count();
  checks.push({
    name: "Migrated data intact (11 categories, 251 models)",
    status: catCount === 11 && modelCount === 251 ? "PASS" : "FAIL",
    detail: `categories=${catCount} models=${modelCount}`,
  });

  // Logged out API
  const unauth = await api(null, "GET", "/api/stats");
  checks.push({
    name: "Logged-out API request rejected",
    status: unauth.status === 401 ? "PASS" : "FAIL",
    detail: `status=${unauth.status} body=${JSON.stringify(unauth.json)}`,
  });

  const roles = [
    {
      email: "admin@example.com",
      role: "Admin",
      expectName: "Admin User",
      canCatPost: true,
      canModelPost: true,
      canImport: true,
    },
    {
      email: "manager@example.com",
      role: "Manager",
      expectName: "Manager User",
      canCatPost: false,
      canModelPost: true,
      canImport: false,
    },
    {
      email: "staff@example.com",
      role: "Staff",
      expectName: "Staff User",
      canCatPost: false,
      canModelPost: false,
      canImport: false,
    },
    {
      email: "viewer@example.com",
      role: "Viewer",
      expectName: "Viewer User",
      canCatPost: false,
      canModelPost: false,
      canImport: false,
    },
  ];

  for (const r of roles) {
    let cookie = "";
    try {
      cookie = await fetchSessionCookie(BASE, r.email, PASSWORD);
    } catch (e) {
      checks.push({
        name: `Login as ${r.role}`,
        status: "FAIL",
        detail: String(e),
      });
      continue;
    }
    checks.push({
      name: `Login as ${r.role}`,
      status: "PASS",
      detail: "session cookie obtained",
    });

    const catPost = await api(cookie, "POST", "/api/category-types", {
      name: `Temp ${r.role} Cat`,
      code: `T${r.role.slice(0, 3).toUpperCase()}`,
    });
    const catOk = r.canCatPost
      ? catPost.status === 201
      : catPost.status === 403;
    checks.push({
      name: `${r.role}: category create ${r.canCatPost ? "allowed" : "forbidden"}`,
      status: catOk ? "PASS" : "FAIL",
      detail: `status=${catPost.status}`,
    });
    if (catPost.status === 201) {
      const id = (catPost.json as { id: string }).id;
      // Hard-delete — API DELETE only archives and leaves test rows behind
      await prisma.categoryType.delete({ where: { id } }).catch(() => undefined);
    }

    const cats = await prisma.categoryType.findMany({ take: 1 });
    const modelPost = await api(cookie, "POST", "/api/asset-models", {
      name: `AUTH-TEST-${r.role}-${Date.now()}`,
      categoryTypeId: cats[0]?.id,
    });
    const modelOk = r.canModelPost
      ? modelPost.status === 201
      : modelPost.status === 403;
    checks.push({
      name: `${r.role}: model create ${r.canModelPost ? "allowed" : "forbidden"}`,
      status: modelOk ? "PASS" : "FAIL",
      detail: `status=${modelPost.status}`,
    });

    if (modelPost.status === 201) {
      const created = modelPost.json as { id: string; updatedBy: string };
      const byOk = created.updatedBy === r.expectName;
      checks.push({
        name: `${r.role}: Updated By = logged-in name`,
        status: byOk ? "PASS" : "FAIL",
        detail: `updatedBy="${created.updatedBy}" expected="${r.expectName}"`,
      });
      // Hard-delete — API DELETE only archives
      await prisma.assetModel.delete({ where: { id: created.id } }).catch(() => undefined);
    }

    // Edit / archive mutations — Staff & Viewer must get 403
    if (!r.canModelPost) {
      const existingModel = await prisma.assetModel.findFirst({
        where: { status: "Active" },
      });
      if (existingModel) {
        const modelPut = await api(
          cookie,
          "PUT",
          `/api/asset-models/${existingModel.id}`,
          {
            name: existingModel.name,
            categoryTypeId: existingModel.categoryTypeId,
          }
        );
        checks.push({
          name: `${r.role}: model edit forbidden`,
          status: modelPut.status === 403 ? "PASS" : "FAIL",
          detail: `status=${modelPut.status}`,
        });

        const modelDel = await api(
          cookie,
          "DELETE",
          `/api/asset-models/${existingModel.id}`
        );
        checks.push({
          name: `${r.role}: model archive forbidden`,
          status: modelDel.status === 403 ? "PASS" : "FAIL",
          detail: `status=${modelDel.status}`,
        });

        const bulk = await api(cookie, "POST", "/api/asset-models/bulk-archive", {
          ids: [existingModel.id],
        });
        checks.push({
          name: `${r.role}: model bulk-archive forbidden`,
          status: bulk.status === 403 ? "PASS" : "FAIL",
          detail: `status=${bulk.status}`,
        });
      }

      const existingCat = await prisma.categoryType.findFirst({
        where: { isActive: true },
      });
      if (existingCat) {
        const catPut = await api(
          cookie,
          "PUT",
          `/api/category-types/${existingCat.id}`,
          { name: existingCat.name, code: existingCat.code }
        );
        checks.push({
          name: `${r.role}: category edit forbidden`,
          status: catPut.status === 403 ? "PASS" : "FAIL",
          detail: `status=${catPut.status}`,
        });
        const catDel = await api(
          cookie,
          "DELETE",
          `/api/category-types/${existingCat.id}`
        );
        checks.push({
          name: `${r.role}: category archive forbidden`,
          status: catDel.status === 403 ? "PASS" : "FAIL",
          detail: `status=${catDel.status}`,
        });
      }

      const existingCust = await prisma.customer.findFirst({
        where: { status: "Active" },
      });
      let customerId = existingCust?.id;
      let tempCustomerId: string | null = null;
      if (!customerId) {
        // Create via Admin session so Staff edit/archive checks always run
        const adminCookie = await fetchSessionCookie(
          BASE,
          "admin@example.com",
          PASSWORD
        );
        const made = await api(adminCookie, "POST", "/api/customers", {
          name: `AUTH-TEMP-${Date.now()}`,
        });
        if (made.status === 201) {
          customerId = (made.json as { id: string }).id;
          tempCustomerId = customerId;
        }
      }
      if (customerId) {
        const custPut = await api(
          cookie,
          "PUT",
          `/api/customers/${customerId}`,
          { name: "Hacked" }
        );
        checks.push({
          name: `${r.role}: customer edit forbidden`,
          status: custPut.status === 403 ? "PASS" : "FAIL",
          detail: `status=${custPut.status}`,
        });
        const custDel = await api(
          cookie,
          "DELETE",
          `/api/customers/${customerId}`
        );
        checks.push({
          name: `${r.role}: customer archive forbidden`,
          status: custDel.status === 403 ? "PASS" : "FAIL",
          detail: `status=${custDel.status}`,
        });
      }

      let existingAsset = await prisma.customerAsset.findFirst();
      let assetId = existingAsset?.id ?? null;
      let assetModelId = existingAsset?.assetModelId ?? null;
      let assetCustomerId = existingAsset?.customerId ?? null;
      let tempAssetId: string | null = null;
      if (!assetId && customerId) {
        const adminCookie = await fetchSessionCookie(
          BASE,
          "admin@example.com",
          PASSWORD
        );
        const model = await prisma.assetModel.findFirst({
          where: { status: "Active" },
        });
        if (model) {
          const made = await api(adminCookie, "POST", "/api/customer-assets", {
            serialNumber: `AUTH-TEMP-SN-${Date.now()}`,
            assetModelId: model.id,
            customerId,
            categoryTypeId: model.categoryTypeId,
            assetStatus: "InUse",
          });
          if (made.status === 201) {
            assetId = (made.json as { id: string }).id;
            assetModelId = model.id;
            assetCustomerId = customerId;
            tempAssetId = assetId;
          }
        }
      }
      if (assetId) {
        const assetPut = await api(
          cookie,
          "PUT",
          `/api/customer-assets/${assetId}`,
          {
            serialNumber: "HACKED",
            assetModelId: assetModelId ?? "x",
            customerId: assetCustomerId ?? customerId,
          }
        );
        checks.push({
          name: `${r.role}: customer-asset edit forbidden`,
          status: assetPut.status === 403 ? "PASS" : "FAIL",
          detail: `status=${assetPut.status}`,
        });
      }

      // Hard-delete any throwaway rows this role created (API DELETE only archives)
      if (tempAssetId) {
        await prisma.customerAsset
          .delete({ where: { id: tempAssetId } })
          .catch(() => undefined);
      }
      if (tempCustomerId) {
        await prisma.customer
          .delete({ where: { id: tempCustomerId } })
          .catch(() => undefined);
      }
    }

    const imp = await api(cookie, "POST", "/api/import", {
      entity: "customers",
      mode: "validate",
      rows: [{ name: "X" }],
    });
    const impOk = r.canImport ? imp.status === 200 : imp.status === 403;
    checks.push({
      name: `${r.role}: import ${r.canImport ? "allowed" : "forbidden"}`,
      status: impOk ? "PASS" : "FAIL",
      detail: `status=${imp.status}`,
    });
  }

  // Bad password
  let badLogin = false;
  try {
    await fetchSessionCookie(BASE, "admin@example.com", "WrongPassword!");
  } catch {
    badLogin = true;
  }
  checks.push({
    name: "Bad password rejected",
    status: badLogin ? "PASS" : "FAIL",
    detail: badLogin ? "login threw as expected" : "unexpectedly succeeded",
  });

  // Final baseline — tests must not leave AUTH/TEMP artifacts behind
  const leftoverModels = await prisma.assetModel.count({
    where: { name: { startsWith: "AUTH-" } },
  });
  const leftoverCats = await prisma.categoryType.count({
    where: {
      OR: [
        { name: { startsWith: "Temp " } },
        { name: { startsWith: "AUTH-" } },
        { code: { in: ["TADM", "TMAN", "TSTA", "TVIE"] } },
      ],
    },
  });
  const catCountAfter = await prisma.categoryType.count();
  const modelCountAfter = await prisma.assetModel.count();
  checks.push({
    name: "Post-test baseline intact (11 categories, 251 models, no AUTH leftovers)",
    status:
      catCountAfter === 11 &&
      modelCountAfter === 251 &&
      leftoverModels === 0 &&
      leftoverCats === 0
        ? "PASS"
        : "FAIL",
    detail: `categories=${catCountAfter} models=${modelCountAfter} leftoverModels=${leftoverModels} leftoverCats=${leftoverCats}`,
  });

  console.log("\n===== AUTH VERIFICATION =====");
  for (const c of checks) {
    console.log(`[${c.status}] ${c.name} — ${c.detail}`);
  }
  const failed = checks.filter((c) => c.status === "FAIL").length;
  console.log(`\nSummary: ${checks.length - failed}/${checks.length} PASS`);
  if (failed) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
