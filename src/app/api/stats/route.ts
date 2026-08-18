import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/stats — dashboard totals + status breakdowns */
export async function GET() {
  const [
    categoriesTotal,
    categoriesActive,
    modelsTotal,
    modelsActive,
    customersTotal,
    customersActive,
    customerAssetsTotal,
    customerInUse,
    customerInStorage,
    customerRetired,
  ] = await Promise.all([
    prisma.categoryType.count(),
    prisma.categoryType.count({ where: { isActive: true } }),
    prisma.assetModel.count(),
    prisma.assetModel.count({ where: { status: "Active" } }),
    prisma.customer.count(),
    prisma.customer.count({ where: { status: "Active" } }),
    prisma.customerAsset.count(),
    prisma.customerAsset.count({ where: { assetStatus: "InUse" } }),
    prisma.customerAsset.count({ where: { assetStatus: "InStorage" } }),
    prisma.customerAsset.count({ where: { assetStatus: "Retired" } }),
  ]);

  return NextResponse.json({
    categories: {
      total: categoriesTotal,
      active: categoriesActive,
      archived: categoriesTotal - categoriesActive,
    },
    models: {
      total: modelsTotal,
      active: modelsActive,
      archived: modelsTotal - modelsActive,
    },
    customers: {
      total: customersTotal,
      active: customersActive,
      archived: customersTotal - customersActive,
    },
    customerAssets: {
      total: customerAssetsTotal,
      inUse: customerInUse,
      inStorage: customerInStorage,
      retired: customerRetired,
    },
  });
}
