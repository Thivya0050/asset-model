import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCategoryLabel } from "@/lib/category";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteCustomerAssets } from "@/lib/roles";

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

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** GET /api/customer-assets — filtered list */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const serial = (sp.get("serial") ?? sp.get("search") ?? "").trim();
  const categoryTypeId = sp.get("categoryTypeId") ?? "";
  const assetModelId = sp.get("assetModelId") ?? "";
  const customerId = sp.get("customerId") ?? "";
  const assetStatus = sp.get("assetStatus") ?? "";
  const warrantyFrom = parseDate(sp.get("warrantyFrom"));
  const warrantyTo = parseDate(sp.get("warrantyTo"));
  const stampingFrom = parseDate(sp.get("stampingFrom"));
  const stampingTo = parseDate(sp.get("stampingTo"));

  const where: Prisma.CustomerAssetWhereInput = {};

  if (serial) where.serialNumber = { contains: serial };
  if (categoryTypeId) where.categoryTypeId = categoryTypeId;
  if (assetModelId) where.assetModelId = assetModelId;
  if (customerId) where.customerId = customerId;
  if (assetStatus) {
    const mapped = statusMap[assetStatus];
    if (mapped) where.assetStatus = mapped;
  }

  if (warrantyFrom || warrantyTo) {
    where.warrantyExpiryDate = {};
    if (warrantyFrom) where.warrantyExpiryDate.gte = warrantyFrom;
    if (warrantyTo) where.warrantyExpiryDate.lte = endOfDay(warrantyTo);
  }

  if (stampingFrom || stampingTo) {
    where.stampingExpiryDate = {};
    if (stampingFrom) where.stampingExpiryDate.gte = stampingFrom;
    if (stampingTo) where.stampingExpiryDate.lte = endOfDay(stampingTo);
  }

  const rows = await prisma.customerAsset.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      assetModel: { select: { id: true, name: true, status: true } },
      categoryType: { select: { id: true, name: true, code: true } },
      customer: { select: { id: true, name: true, status: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      categoryType: {
        ...r.categoryType,
        name: formatCategoryLabel(r.categoryType.name, r.categoryType.code),
        code: r.categoryType.code,
      },
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(canWriteCustomerAssets);
  if (isErrorResponse(user)) return user;

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

  const model = await prisma.assetModel.findFirst({
    where: { id: assetModelId, status: "Active" },
  });
  if (!model) {
    return NextResponse.json(
      { error: "Asset Model not found or archived" },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, status: "Active" },
  });
  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found or archived" },
      { status: 400 }
    );
  }

  const assetStatus = statusMap[String(body.assetStatus ?? "InUse")] ?? "InUse";

  const created = await prisma.customerAsset.create({
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

  return NextResponse.json(created, { status: 201 });
}
