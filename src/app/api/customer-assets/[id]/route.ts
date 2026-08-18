import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteCustomerAssets } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

const statusMap: Record<string, "InUse" | "InStorage" | "Retired"> = {
  "In Use": "InUse",
  InUse: "InUse",
  "In Storage": "InStorage",
  InStorage: "InStorage",
  Retired: "Retired",
};

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.customerAsset.findUnique({
    where: { id },
    include: {
      assetModel: true,
      categoryType: true,
      customer: true,
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requirePermission(canWriteCustomerAssets);
  if (isErrorResponse(user)) return user;

  const { id } = await ctx.params;
  const body = await req.json();
  const serialNumber = String(body.serialNumber ?? "").trim();
  const assetModelId = String(body.assetModelId ?? "").trim();
  const customerId = String(body.customerId ?? "").trim();
  const updatedBy = user.name;

  if (!serialNumber || !assetModelId || !customerId) {
    return NextResponse.json(
      { error: "Serial number, Asset Model, and Customer are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.customerAsset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const model = await prisma.assetModel.findFirst({
    where: {
      id: assetModelId,
      OR: [{ status: "Active" }, { id: existing.assetModelId }],
    },
  });
  if (!model) {
    return NextResponse.json(
      { error: "Asset Model not found or archived" },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      OR: [{ status: "Active" }, { id: existing.customerId }],
    },
  });
  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found or archived" },
      { status: 400 }
    );
  }

  const assetStatus = statusMap[String(body.assetStatus ?? "InUse")] ?? "InUse";

  const updated = await prisma.customerAsset.update({
    where: { id },
    data: {
      serialNumber,
      assetModelId: model.id,
      categoryTypeId: model.categoryTypeId,
      customerId: customer.id,
      assetStatus,
      warrantyExpiryDate: parseDate(body.warrantyExpiryDate),
      stampingExpiryDate: parseDate(body.stampingExpiryDate),
      updatedBy,
    },
    include: {
      assetModel: true,
      categoryType: true,
      customer: true,
    },
  });

  return NextResponse.json(updated);
}
