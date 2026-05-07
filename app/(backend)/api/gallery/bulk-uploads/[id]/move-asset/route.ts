import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bulkUploadId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    assetId?: string;
    toBucketId?: string;
  };

  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  const toBucketId = typeof body.toBucketId === "string" ? body.toBucketId : "";
  if (!assetId || !toBucketId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [bulk, asset, bucket] = await Promise.all([
    prisma.bulkUpload.findFirst({
      where: { id: bulkUploadId, companyId: session.companyId },
      select: { id: true },
    }),
    prisma.asset.findFirst({
      where: { id: assetId, companyId: session.companyId, bulkUploadId },
      select: { id: true },
    }),
    prisma.assetBucket.findFirst({
      where: { id: toBucketId, companyId: session.companyId, bulkUploadId },
      select: { id: true },
    }),
  ]);

  if (!bulk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (!bucket) return NextResponse.json({ error: "Bucket not found" }, { status: 404 });

  await prisma.asset.update({
    where: { id: assetId },
    data: { assetBucketId: toBucketId },
  });

  return NextResponse.json({ ok: true });
}

