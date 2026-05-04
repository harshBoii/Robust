import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    companyId?: string;
    name?: string;
    /** Optional: attach existing company assets (e.g. orphans) to this bulk upload. */
    assetIds?: unknown;
  };

  const { companyId, name, assetIds } = body;

  if (!companyId || typeof companyId !== "string") {
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 },
    );
  }

  if (companyId !== session.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bulkUpload = await prisma.bulkUpload.create({
    data: {
      companyId,
      name:
        typeof name === "string" && name.trim()
          ? name.trim().slice(0, 255)
          : `Upload ${new Date().toLocaleString()}`,
      status: "PROCESSING",
    },
  });

  const ids =
    Array.isArray(assetIds) && assetIds.length > 0
      ? assetIds
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, 500)
      : [];

  let linkedCount = 0;
  if (ids.length > 0) {
    const result = await prisma.asset.updateMany({
      where: {
        companyId,
        id: { in: ids },
        bulkUploadId: null,
      },
      data: { bulkUploadId: bulkUpload.id },
    });
    linkedCount = result.count;
  }

  return NextResponse.json({
    bulkUploadId: bulkUpload.id,
    linkedAssetCount: linkedCount,
  });
}
