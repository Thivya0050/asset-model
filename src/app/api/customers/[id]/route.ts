import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatCategoryLabel } from "@/lib/category";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteCustomers } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

function parseCoord(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.customer.findUnique({
    where: { id },
    include: {
      customerAssets: {
        orderBy: { updatedAt: "desc" },
        include: {
          assetModel: { select: { id: true, name: true } },
          categoryType: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let inUse = 0;
  let inStorage = 0;
  let retired = 0;
  for (const a of row.customerAssets) {
    if (a.assetStatus === "InUse") inUse++;
    else if (a.assetStatus === "InStorage") inStorage++;
    else if (a.assetStatus === "Retired") retired++;
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    assetCount: row.customerAssets.length,
    assetStats: {
      total: row.customerAssets.length,
      inUse,
      inStorage,
      retired,
    },
    assets: row.customerAssets.map((a) => ({
      id: a.id,
      serialNumber: a.serialNumber,
      assetStatus: a.assetStatus,
      warrantyExpiryDate: a.warrantyExpiryDate,
      stampingExpiryDate: a.stampingExpiryDate,
      updatedAt: a.updatedAt,
      updatedBy: a.updatedBy,
      assetModel: a.assetModel,
      categoryType: {
        id: a.categoryType.id,
        name: formatCategoryLabel(a.categoryType.name, a.categoryType.code),
        code: a.categoryType.code,
      },
    })),
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canWriteCustomers);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const updatedBy = user.name;
  const latitude = parseCoord(body.latitude);
  const longitude = parseCoord(body.longitude);

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const clash = await prisma.customer.findFirst({
    where: { name, NOT: { id } },
  });
  if (clash) {
    return NextResponse.json(
      { error: "A customer with this name already exists" },
      { status: 409 }
    );
  }

  try {
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        status: body.status === "Inactive" ? "Inactive" : "Active",
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        updatedBy,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/** Archive = Inactive (never hard-delete) */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canWriteCustomers);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;

  try {
    const updated = await prisma.customer.update({
      where: { id },
      data: { status: "Inactive", updatedBy: user.name },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
