import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatCategoryLabel,
  parseCategoryLabel,
} from "@/lib/category";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canManageCategories } from "@/lib/roles";

/** GET /api/category-types — list with assetCount rollup */
export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("all") === "1";

  const rows = await prisma.categoryType.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assetModels: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      label: formatCategoryLabel(r.name, r.code),
      isActive: r.isActive,
      assetCount: r._count.assetModels,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy,
    }))
  );
}

/** POST /api/category-types — create */
export async function POST(req: NextRequest) {
  const user = await requirePermission(canManageCategories);
  if (isErrorResponse(user)) return user;

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

  const existingName = await prisma.categoryType.findUnique({ where: { name } });
  if (existingName) {
    return NextResponse.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }
  const existingCode = await prisma.categoryType.findFirst({ where: { code } });
  if (existingCode) {
    return NextResponse.json(
      { error: "A category with this code already exists" },
      { status: 409 }
    );
  }

  const created = await prisma.categoryType.create({
    data: { name, code, updatedBy },
  });

  return NextResponse.json(
    { ...created, label: formatCategoryLabel(created.name, created.code) },
    { status: 201 }
  );
}
