import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canBulkImport } from "@/lib/roles";
import {
  type ImportEntity,
  type MappedRow,
  normalizeName,
  parseMigrationDate,
} from "@/lib/import/schema";
import {
  formatCategoryLabel,
  parseCategoryLabel,
} from "@/lib/category";

type RowResult = {
  rowIndex: number;
  status: "ok" | "error" | "duplicate";
  message?: string;
  data: MappedRow;
};

const statusMap: Record<string, "InUse" | "InStorage" | "Retired"> = {
  "in use": "InUse",
  inuse: "InUse",
  "in storage": "InStorage",
  instorage: "InStorage",
  retired: "Retired",
};

function toInt(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toFloat(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string): Date | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isEntity(v: string): v is ImportEntity {
  return (
    v === "categories" ||
    v === "asset-models" ||
    v === "customers" ||
    v === "customer-assets"
  );
}

async function validateRows(
  entity: ImportEntity,
  rows: MappedRow[],
  migrationMode: boolean
): Promise<RowResult[]> {
  const base = await validateEntityRows(entity, rows);
  if (!migrationMode) return base;

  return base.map((r) => {
    if (r.status === "error") return r;
    const rawDate = (r.data.updatedAt ?? "").trim();
    if (rawDate && !parseMigrationDate(rawDate)) {
      return {
        ...r,
        status: "error" as const,
        message: `Updated On '${rawDate}' is not a valid date. Use formats like 2025/04/10 or 2025-04-10.`,
      };
    }
    return r;
  });
}

async function validateEntityRows(
  entity: ImportEntity,
  rows: MappedRow[]
): Promise<RowResult[]> {
  if (entity === "categories") {
    const existing = await prisma.categoryType.findMany({
      select: { name: true, code: true },
    });
    const names = new Set(existing.map((c) => normalizeName(c.name)));
    const codes = new Set(
      existing.map((c) => normalizeName(c.code)).filter(Boolean)
    );
    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();
    return rows.map((data, rowIndex) => {
      let name = (data.name ?? "").trim();
      let code = (data.code ?? "").trim();
      // Combined "Name (CODE)" in the Name/Category column
      if (name && !code) {
        const parsed = parseCategoryLabel(name);
        name = parsed.name;
        code = parsed.code;
      }
      if (!name) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Name is required.",
          data,
        };
      }
      if (!code) {
        return {
          rowIndex,
          status: "error" as const,
          message:
            "Code is required — provide a Code column, or use Name as 'Name (CODE)'.",
          data,
        };
      }
      const nameKey = normalizeName(name);
      const codeKey = normalizeName(code);
      if (names.has(nameKey)) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Category '${name}' already exists.`,
          data: { ...data, name, code },
        };
      }
      if (codes.has(codeKey)) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Category code '${code}' already exists.`,
          data: { ...data, name, code },
        };
      }
      if (seenNames.has(nameKey)) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Duplicate name '${name}' appears more than once in this file.`,
          data: { ...data, name, code },
        };
      }
      if (seenCodes.has(codeKey)) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Duplicate code '${code}' appears more than once in this file.`,
          data: { ...data, name, code },
        };
      }
      seenNames.add(nameKey);
      seenCodes.add(codeKey);
      return {
        rowIndex,
        status: "ok" as const,
        data: { ...data, name, code },
      };
    });
  }

  if (entity === "customers") {
    const existing = await prisma.customer.findMany({ select: { name: true } });
    const names = new Set(existing.map((c) => normalizeName(c.name)));
    const seen = new Set<string>();
    return rows.map((data, rowIndex) => {
      const name = (data.name ?? "").trim();
      if (!name) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Name is required.",
          data,
        };
      }
      const key = normalizeName(name);
      if (names.has(key)) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Customer '${name}' already exists.`,
          data,
        };
      }
      if (seen.has(key)) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Duplicate '${name}' appears more than once in this file.`,
          data,
        };
      }
      seen.add(key);
      return { rowIndex, status: "ok" as const, data };
    });
  }

  if (entity === "asset-models") {
    const categories = await prisma.categoryType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    });
    /** Resolve "Weighing Scale (SCL)", "Weighing Scale", or "SCL" */
    const resolveCategory = (raw: string) => {
      const key = normalizeName(raw);
      const matches = categories.filter((c) => {
        const label = normalizeName(formatCategoryLabel(c.name, c.code));
        return (
          label === key ||
          normalizeName(c.name) === key ||
          normalizeName(c.code) === key
        );
      });
      return matches;
    };
    const models = await prisma.assetModel.findMany({
      select: { name: true, categoryTypeId: true },
    });
    const modelKeys = new Set(
      models.map((m) => `${normalizeName(m.name)}|${m.categoryTypeId}`)
    );

    return rows.map((data, rowIndex) => {
      const name = (data.name ?? "").trim();
      const category = (data.category ?? "").trim();
      if (!name) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Model Name is required.",
          data,
        };
      }
      if (!category) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Category is required.",
          data,
        };
      }
      const catMatches = resolveCategory(category);
      if (catMatches.length === 0) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Category '${category}' not found — check spelling (active categories only).`,
          data,
        };
      }
      if (catMatches.length > 1) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Category '${category}' matches more than one active category.`,
          data,
        };
      }
      const cat = catMatches[0];
      if (data.defaultWarrantyMonths && toInt(data.defaultWarrantyMonths) == null) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Default Warranty (months) must be a number.",
          data,
        };
      }
      if (data.defaultStampingMonths && toInt(data.defaultStampingMonths) == null) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Default Stamping (months) must be a number.",
          data,
        };
      }
      if (data.unitCost && toFloat(data.unitCost) == null) {
        return {
          rowIndex,
          status: "error" as const,
          message: "Unit Cost must be a number.",
          data,
        };
      }
      const dupKey = `${normalizeName(name)}|${cat.id}`;
      const catLabel = formatCategoryLabel(cat.name, cat.code);
      if (modelKeys.has(dupKey)) {
        return {
          rowIndex,
          status: "duplicate" as const,
          message: `A model named '${name}' already exists in category '${catLabel}'.`,
          data: { ...data, _categoryTypeId: cat.id },
        };
      }
      return {
        rowIndex,
        status: "ok" as const,
        data: { ...data, _categoryTypeId: cat.id },
      };
    });
  }

  // customer-assets
  const [models, customers, existingSerials] = await Promise.all([
    prisma.assetModel.findMany({
      where: { status: "Active" },
      select: { id: true, name: true, categoryTypeId: true },
    }),
    prisma.customer.findMany({
      where: { status: "Active" },
      select: { id: true, name: true },
    }),
    prisma.customerAsset.findMany({ select: { serialNumber: true } }),
  ]);
  const modelByName = new Map<string, typeof models>();
  for (const m of models) {
    const key = normalizeName(m.name);
    const list = modelByName.get(key) ?? [];
    list.push(m);
    modelByName.set(key, list);
  }
  const customerByName = new Map<string, typeof customers>();
  for (const c of customers) {
    const key = normalizeName(c.name);
    const list = customerByName.get(key) ?? [];
    list.push(c);
    customerByName.set(key, list);
  }
  const serials = new Set(existingSerials.map((s) => normalizeName(s.serialNumber)));

  return rows.map((data, rowIndex) => {
    const serialNumber = (data.serialNumber ?? "").trim();
    const assetModel = (data.assetModel ?? "").trim();
    const customer = (data.customer ?? "").trim();
    if (!serialNumber) {
      return {
        rowIndex,
        status: "error" as const,
        message: "Serial Number is required.",
        data,
      };
    }
    if (!assetModel) {
      return {
        rowIndex,
        status: "error" as const,
        message: "Asset Model is required.",
        data,
      };
    }
    if (!customer) {
      return {
        rowIndex,
        status: "error" as const,
        message: "Customer is required.",
        data,
      };
    }
    const modelMatches = modelByName.get(normalizeName(assetModel)) ?? [];
    if (modelMatches.length === 0) {
      return {
        rowIndex,
        status: "error" as const,
        message: `Asset Model '${assetModel}' not found — check spelling (active models only).`,
        data,
      };
    }
    if (modelMatches.length > 1) {
      return {
        rowIndex,
        status: "error" as const,
        message: `Asset Model '${assetModel}' matches ${modelMatches.length} active models — rename so names are unique, or import via the UI.`,
        data,
      };
    }
    const model = modelMatches[0];
    const custMatches = customerByName.get(normalizeName(customer)) ?? [];
    if (custMatches.length === 0) {
      return {
        rowIndex,
        status: "error" as const,
        message: `Customer '${customer}' not found — check spelling (active customers only).`,
        data,
      };
    }
    if (custMatches.length > 1) {
      return {
        rowIndex,
        status: "error" as const,
        message: `Customer '${customer}' matches more than one active customer.`,
        data,
      };
    }
    const cust = custMatches[0];
    if (data.assetStatus) {
      const key = normalizeName(data.assetStatus);
      if (!statusMap[key]) {
        return {
          rowIndex,
          status: "error" as const,
          message: `Asset Status '${data.assetStatus}' is invalid. Use In Use, In Storage, or Retired.`,
          data,
        };
      }
    }
    if (data.warrantyExpiryDate && !toDate(data.warrantyExpiryDate)) {
      return {
        rowIndex,
        status: "error" as const,
        message: "Warranty Expiry Date is not a valid date.",
        data,
      };
    }
    if (data.stampingExpiryDate && !toDate(data.stampingExpiryDate)) {
      return {
        rowIndex,
        status: "error" as const,
        message: "Stamping Expiry Date is not a valid date.",
        data,
      };
    }
    const enriched = {
      ...data,
      _assetModelId: model.id,
      _categoryTypeId: model.categoryTypeId,
      _customerId: cust.id,
    };
    if (serials.has(normalizeName(serialNumber))) {
      return {
        rowIndex,
        status: "duplicate" as const,
        message: `Serial '${serialNumber}' already exists.`,
        data: enriched,
      };
    }
    return { rowIndex, status: "ok" as const, data: enriched };
  });
}

async function commitRows(
  entity: ImportEntity,
  rows: RowResult[],
  defaultUpdatedBy: string,
  includeDuplicates: boolean,
  migrationMode: boolean
) {
  const toImport = rows.filter(
    (r) =>
      r.status === "ok" || (includeDuplicates && r.status === "duplicate")
  );

  if (toImport.length === 0) {
    return { imported: 0, skipped: rows.length };
  }

  const auditFor = (r: RowResult) => {
    const by =
      migrationMode && (r.data.updatedBy ?? "").trim()
        ? r.data.updatedBy.trim()
        : defaultUpdatedBy;
    const at =
      migrationMode && (r.data.updatedAt ?? "").trim()
        ? parseMigrationDate(r.data.updatedAt)
        : null;
    return { updatedBy: by, updatedAt: at ?? undefined };
  };

  await prisma.$transaction(async (tx) => {
    if (entity === "categories") {
      for (const r of toImport) {
        const audit = auditFor(r);
        await tx.categoryType.create({
          data: {
            name: r.data.name.trim(),
            code: r.data.code.trim(),
            updatedBy: audit.updatedBy,
            ...(audit.updatedAt ? { updatedAt: audit.updatedAt } : {}),
          },
        });
      }
      return;
    }
    if (entity === "customers") {
      for (const r of toImport) {
        const audit = auditFor(r);
        await tx.customer.create({
          data: {
            name: r.data.name.trim(),
            status: "Active",
            updatedBy: audit.updatedBy,
            ...(audit.updatedAt ? { updatedAt: audit.updatedAt } : {}),
          },
        });
      }
      return;
    }
    if (entity === "asset-models") {
      for (const r of toImport) {
        const audit = auditFor(r);
        await tx.assetModel.create({
          data: {
            name: r.data.name.trim(),
            categoryTypeId: r.data._categoryTypeId,
            manufacturer: r.data.manufacturer?.trim() || null,
            description: r.data.description?.trim() || null,
            defaultWarrantyMonths: toInt(r.data.defaultWarrantyMonths ?? ""),
            defaultStampingMonths: toInt(r.data.defaultStampingMonths ?? ""),
            unitCost: toFloat(r.data.unitCost ?? ""),
            status: "Active",
            updatedBy: audit.updatedBy,
            ...(audit.updatedAt ? { updatedAt: audit.updatedAt } : {}),
          },
        });
      }
      return;
    }
    for (const r of toImport) {
      const statusKey = normalizeName(r.data.assetStatus || "in use");
      const audit = auditFor(r);
      await tx.customerAsset.create({
        data: {
          serialNumber: r.data.serialNumber.trim(),
          assetModelId: r.data._assetModelId,
          categoryTypeId: r.data._categoryTypeId,
          customerId: r.data._customerId,
          assetStatus: statusMap[statusKey] ?? "InUse",
          warrantyExpiryDate: toDate(r.data.warrantyExpiryDate ?? ""),
          stampingExpiryDate: toDate(r.data.stampingExpiryDate ?? ""),
          updatedBy: audit.updatedBy,
          ...(audit.updatedAt ? { updatedAt: audit.updatedAt } : {}),
        },
      });
    }
  });

  return {
    imported: toImport.length,
    skipped: rows.length - toImport.length,
  };
}

/**
 * POST /api/import
 * body: { entity, mode: "validate"|"commit", rows, updatedBy?, includeDuplicates?, migrationMode? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(canBulkImport);
    if (isErrorResponse(user)) return user;

    const body = await req.json();
    const entity = String(body.entity ?? "");
    const mode = String(body.mode ?? "validate");
    const updatedBy = user.name;
    const includeDuplicates = Boolean(body.includeDuplicates);
    const migrationMode = Boolean(body.migrationMode);
    const rows = Array.isArray(body.rows) ? (body.rows as MappedRow[]) : [];

    if (!isEntity(entity)) {
      return NextResponse.json({ error: "Unknown entity." }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json(
        { error: "Import is limited to 2,000 rows at a time." },
        { status: 400 }
      );
    }

    const validated = await validateRows(entity, rows, migrationMode);

    if (mode === "validate") {
      const ready = validated.filter((r) => r.status === "ok").length;
      const errors = validated.filter((r) => r.status === "error").length;
      const duplicates = validated.filter((r) => r.status === "duplicate").length;
      return NextResponse.json({
        rows: validated,
        summary: { ready, errors, duplicates, total: validated.length },
      });
    }

    if (mode === "commit") {
      // Re-validate so IDs/resolutions are fresh
      const fresh = await validateRows(entity, rows, migrationMode);
      const result = await commitRows(
        entity,
        fresh,
        updatedBy,
        includeDuplicates,
        migrationMode
      );
      const skippedRows = fresh
        .filter(
          (r) =>
            r.status === "error" ||
            (!includeDuplicates && r.status === "duplicate")
        )
        .map((r) => ({
          row: r.rowIndex + 2, // +2: header + 1-based
          reason: r.message ?? "Skipped",
          ...Object.fromEntries(
            Object.entries(r.data).filter(([k]) => !k.startsWith("_"))
          ),
        }));
      return NextResponse.json({
        ...result,
        skippedRows,
        summary: {
          ready: fresh.filter((r) => r.status === "ok").length,
          errors: fresh.filter((r) => r.status === "error").length,
          duplicates: fresh.filter((r) => r.status === "duplicate").length,
        },
      });
    }

    return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  } catch (e) {
    console.error("Import failed", e);
    return NextResponse.json(
      { error: "Import failed. Please check your file and try again." },
      { status: 500 }
    );
  }
}
