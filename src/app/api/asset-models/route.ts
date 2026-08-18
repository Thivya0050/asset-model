import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCategoryLabel } from "@/lib/category";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteAssetModels } from "@/lib/roles";

/**
 * GET /api/asset-models
 * Supports: search, categoryTypeId, status, sort, page, pageSize, ids
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const search = (sp.get("search") ?? "").trim();
  const categoryTypeId = sp.get("categoryTypeId") ?? "";
  const status = sp.get("status") ?? "";
  const sort = sp.get("sort") ?? "updatedAt";
  const order = sp.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = [10, 25, 50, 100].includes(Number(sp.get("pageSize")))
    ? Number(sp.get("pageSize"))
    : 10;
  const ids = sp.get("ids");

  const where: Prisma.AssetModelWhereInput = {};

  if (ids) {
    where.id = { in: ids.split(",").filter(Boolean) };
  } else {
    if (search) where.name = { contains: search };
    if (categoryTypeId) where.categoryTypeId = categoryTypeId;
    if (status === "Active" || status === "Inactive") where.status = status;
  }

  const allowedSort = new Set(["name", "status", "updatedAt", "updatedBy"]);
  const sortField = allowedSort.has(sort) ? sort : "updatedAt";

  const [total, rows] = await Promise.all([
    prisma.assetModel.count({ where }),
    prisma.assetModel.findMany({
      where,
      include: {
        categoryType: { select: { id: true, name: true, code: true } },
        _count: { select: { customerAssets: true } },
      },
      orderBy: { [sortField]: order },
      skip: ids ? undefined : (page - 1) * pageSize,
      take: ids ? undefined : pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      categoryTypeId: r.categoryTypeId,
      categoryName: formatCategoryLabel(r.categoryType.name, r.categoryType.code),
      categoryCode: r.categoryType.code,
      manufacturer: r.manufacturer,
      description: r.description,
      defaultWarrantyMonths: r.defaultWarrantyMonths,
      defaultStampingMonths: r.defaultStampingMonths,
      unitCost: r.unitCost,
      imageUrl: r.imageUrl,
      attachmentUrl: r.attachmentUrl,
      status: r.status,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy,
      customerAssetCount: r._count.customerAssets,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(canWriteAssetModels);
  if (isErrorResponse(user)) return user;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const categoryTypeId = String(body.categoryTypeId ?? "").trim();
  const updatedBy = user.name;

  if (!name || !categoryTypeId) {
    return NextResponse.json(
      { error: "Model Name and Category are required" },
      { status: 400 }
    );
  }

  const category = await prisma.categoryType.findFirst({
    where: { id: categoryTypeId, isActive: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // ASSUMPTION: duplicate name within same category → warn but allow save
  const duplicate = await prisma.assetModel.findFirst({
    where: { name, categoryTypeId },
  });

  const created = await prisma.assetModel.create({
    data: {
      name,
      categoryTypeId,
      manufacturer: emptyToNull(body.manufacturer),
      description: emptyToNull(body.description),
      defaultWarrantyMonths: toIntOrNull(body.defaultWarrantyMonths),
      defaultStampingMonths: toIntOrNull(body.defaultStampingMonths),
      unitCost: toFloatOrNull(body.unitCost),
      imageUrl: emptyToNull(body.imageUrl),
      attachmentUrl: emptyToNull(body.attachmentUrl),
      status: body.status === "Inactive" ? "Inactive" : "Active",
      updatedBy,
    },
    include: { categoryType: true },
  });

  return NextResponse.json(
    {
      ...created,
      duplicateWarning: duplicate
        ? "Another model with this name already exists in this category."
        : null,
    },
    { status: 201 }
  );
}

function emptyToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toIntOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toFloatOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
