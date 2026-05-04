import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { companyId, name } = body;

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 }
    );
  }

  const bulkUpload = await prisma.bulkUpload.create({
    data: {
      companyId,
      name: name ?? `Upload ${new Date().toLocaleString()}`,
      status: "PROCESSING",
    },
  });

  return NextResponse.json({ bulkUploadId: bulkUpload.id });
}
