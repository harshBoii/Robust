import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { generatePresignedUrl, getR2PublicObjectUrl } from "@/lib/cloudfare/r2";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const asset = await prisma.asset.findFirst({
    where: {
      id,
      companyId: session.companyId,
    },
    select: {
      assetType: true,
      status: true,
      r2Key: true,
      r2Bucket: true,
      playbackUrl: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (asset.assetType === "VIDEO") {
    if (!asset.playbackUrl) {
      return NextResponse.json(
        { error: "Video still processing" },
        { status: 202 }
      );
    }
    // Return CF Stream HLS URL directly — no presigning needed
    return NextResponse.json({ url: asset.playbackUrl, type: "hls" });
  }

  // Image/Document — public bucket URL when configured, else presigned R2 URL
  const publicUrl = getR2PublicObjectUrl(asset.r2Key);
  if (publicUrl) {
    return NextResponse.json({ url: publicUrl, type: "r2" });
  }
  const url = await generatePresignedUrl(asset.r2Key, asset.r2Bucket);
  return NextResponse.json({ url, type: "r2" });
}