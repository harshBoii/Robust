import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { analyzeBulkUpload } from "@/lib/gallery/analyze-bulk";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const bulk = await prisma.bulkUpload.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!bulk) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Read mode from request body
  const { mode = 'metadata' } = (await req.json().catch(() => ({}))) as {
    mode?: string;
  };

  try {
    const result = await analyzeBulkUpload(
      id,
      session.companyId,
      mode === 'content' ? 'content' : 'metadata',
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[gallery/bulk-uploads/analyze] POST", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analyze failed" },
      { status: 500 },
    );
  }
}

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const bulk = await prisma.bulkUpload.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!bulk) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buckets = await prisma.assetBucket.findMany({
    where: { bulkUploadId: id, companyId: session.companyId },
    select: {
      id: true,
      label: true,
      bucketType: true,
      bucketValue: true,
      _count: { select: { assets: true } },
    },
    orderBy: { label: "asc" },
  });

  return NextResponse.json({
    buckets: buckets.map((b) => ({
      id: b.id,
      label: b.label,
      bucketType: b.bucketType,
      bucketValue: b.bucketValue,
      assetCount: b._count.assets,
    })),
  });
}
