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
    bucketId?: string;
    label?: string;
  };

  const bucketId = typeof body.bucketId === "string" ? body.bucketId : "";
  const label =
    typeof body.label === "string" ? body.label.trim().slice(0, 255) : "";

  if (!bucketId || !label) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [bulk, bucket] = await Promise.all([
    prisma.bulkUpload.findFirst({
      where: { id: bulkUploadId, companyId: session.companyId },
      select: { id: true },
    }),
    prisma.assetBucket.findFirst({
      where: { id: bucketId, bulkUploadId, companyId: session.companyId },
      select: { id: true },
    }),
  ]);

  if (!bulk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!bucket) return NextResponse.json({ error: "Bucket not found" }, { status: 404 });

  const updated = await prisma.assetBucket.update({
    where: { id: bucketId },
    data: { label },
    select: { id: true, label: true },
  });

  return NextResponse.json({ bucket: updated });
}

