import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteAssetModels } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.assetModel.findUnique({
    where: { id },
    include: {
      categoryType: true,
      _count: { select: { customerAssets: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...row,
    customerAssetCount: row._count.customerAssets,
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canWriteAssetModels);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;
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

  const duplicate = await prisma.assetModel.findFirst({
    where: { name, categoryTypeId, NOT: { id } },
  });

  try {
    const updated = await prisma.assetModel.update({
      where: { id },
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
      include: {
        categoryType: true,
        _count: { select: { customerAssets: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      customerAssetCount: updated._count.customerAssets,
      duplicateWarning: duplicate
        ? "Another model with this name already exists in this category."
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/** Archive = set status Inactive (never hard-delete) */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canWriteAssetModels);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;

  try {
    const updated = await prisma.assetModel.update({
      where: { id },
      data: { status: "Inactive", updatedBy: user.name },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
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
