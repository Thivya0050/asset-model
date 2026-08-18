import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatCategoryLabel,
  parseCategoryLabel,
} from "@/lib/category";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canManageCategories } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.categoryType.findUnique({
    where: { id },
    include: { _count: { select: { assetModels: true } } },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...row,
    label: formatCategoryLabel(row.name, row.code),
    assetCount: row._count.assetModels,
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canManageCategories);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;
  const body = await req.json();
  let name = String(body.name ?? "").trim();
  let code = String(body.code ?? "").trim();
  const updatedBy = user.name;

  if (name && !code) {
    const parsed = parseCategoryLabel(name);
    name = parsed.name;
    code = parsed.code;
  }

  if (!name || !code) {
    return NextResponse.json(
      { error: "Name and Code are required" },
      { status: 400 }
    );
  }

  const clashName = await prisma.categoryType.findFirst({
    where: { name, NOT: { id } },
  });
  if (clashName) {
    return NextResponse.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }
  const clashCode = await prisma.categoryType.findFirst({
    where: { code, NOT: { id } },
  });
  if (clashCode) {
    return NextResponse.json(
      { error: "A category with this code already exists" },
      { status: 409 }
    );
  }

  try {
    const updated = await prisma.categoryType.update({
      where: { id },
      data: { name, code, updatedBy },
    });
    return NextResponse.json({
      ...updated,
      label: formatCategoryLabel(updated.name, updated.code),
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/** Archive (soft) — never hard-delete */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canManageCategories);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;
  try {
    const updated = await prisma.categoryType.update({
      where: { id },
      data: { isActive: false, updatedBy: user.name },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
