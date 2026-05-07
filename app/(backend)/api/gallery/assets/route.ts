import { NextRequest, NextResponse } from "next/server";

import { AssetType } from "@/app/generated/prisma/enums";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const assetTypeFilter =
    typeParam === "IMAGE" || typeParam === "VIDEO" ? typeParam : undefined;
  const bulkUploadId = req.nextUrl.searchParams.get("bulkUploadId") ?? undefined;

  const assets = await prisma.asset.findMany({
    where: {
      companyId: session.companyId,
      ...(bulkUploadId ? { bulkUploadId } : {}),
      ...(assetTypeFilter
        ? { assetType: assetTypeFilter as AssetType }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      filename: true,
      assetType: true,
      status: true,
      thumbnailUrl: true,
      playbackUrl: true,
      mimeType: true,
      duration: true,
      resolution: true,
      createdAt: true,
      streamId: true,
      bulkUploadId: true,
      assetBucketId: true,
      bulkUpload: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      },
      assetBucket: {
        select: {
          id: true,
          label: true,
          bucketType: true,
          bucketValue: true,
        },
      },
    },
  });

  return NextResponse.json({ assets });
}
