import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isErrorResponse, requirePermission } from "@/lib/auth-helpers";
import { canWriteAssetModels } from "@/lib/roles";

/** Bulk archive Asset Models — sets status Inactive */
export async function POST(req: NextRequest) {
  const user = await requirePermission(canWriteAssetModels);
  if (isErrorResponse(user)) return user;

  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const result = await prisma.assetModel.updateMany({
    where: { id: { in: ids } },
    data: { status: "Inactive", updatedBy: user.name },
  });

  return NextResponse.json({ archived: result.count });
}
