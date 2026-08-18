import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteCustomers } from "@/lib/roles";

function parseCoord(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** GET /api/customers — list with optional all=1 for archived */
export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  const withStats = req.nextUrl.searchParams.get("stats") === "1";

  const rows = await prisma.customer.findMany({
    where: includeInactive ? undefined : { status: "Active" },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { customerAssets: true } },
      ...(withStats
        ? {
            customerAssets: {
              select: { assetStatus: true },
            },
          }
        : {}),
    },
  });

  return NextResponse.json(
    rows.map((r) => {
      const base = {
        id: r.id,
        name: r.name,
        status: r.status,
        latitude: r.latitude,
        longitude: r.longitude,
        assetCount: r._count.customerAssets,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      };

      if (!withStats || !("customerAssets" in r)) return base;

      const assets = (
        r as typeof r & {
          customerAssets: { assetStatus: string }[];
        }
      ).customerAssets;
      let inUse = 0;
      let inStorage = 0;
      let retired = 0;
      for (const a of assets) {
        if (a.assetStatus === "InUse") inUse++;
        else if (a.assetStatus === "InStorage") inStorage++;
        else if (a.assetStatus === "Retired") retired++;
      }

      return {
        ...base,
        assetStats: { total: assets.length, inUse, inStorage, retired },
      };
    })
  );
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(canWriteCustomers);
  if (isErrorResponse(user)) return user;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const updatedBy = user.name;
  const latitude = parseCoord(body.latitude);
  const longitude = parseCoord(body.longitude);

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A customer with this name already exists" },
      { status: 409 }
    );
  }

  const created = await prisma.customer.create({
    data: {
      name,
      status: body.status === "Inactive" ? "Inactive" : "Active",
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      updatedBy,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
