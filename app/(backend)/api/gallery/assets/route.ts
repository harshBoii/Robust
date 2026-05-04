import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assets = await prisma.asset.findMany({
    where: { companyId: session.companyId },
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
      createdAt: true,
      streamId: true,
    },
  });

  return NextResponse.json({ assets });
}
