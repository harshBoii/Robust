import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "@/lib/cloudfare/r2";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { sessionId, partNumber } = await req.json();

  const session = await prisma.uploadSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  const presignedUrl = await getSignedUrl(
    r2,
    new UploadPartCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: session.key,
      UploadId: session.uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: 3600 }
  );

  return NextResponse.json({ presignedUrl });
}