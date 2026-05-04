import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/cloudfare/r2";
import { prisma } from "@/lib/prisma";
import { enqueueAssetStreamUpload } from "@/lib/cloudfare/stream";
import { AssetType, AssetStatus, UploadSource } from "@/app/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { sessionId, parts, assetType, title } = await req.json();

  const session = await prisma.uploadSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  // 1. Complete multipart on R2
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: session.key,
      UploadId: session.uploadId,
      MultipartUpload: { Parts: parts },
    })
  );

  // 2. Determine asset type from mime if not provided
  const resolvedType: AssetType =
    assetType ??
    (session.fileType.startsWith("video/") ? "VIDEO" : "IMAGE");

  // 3. Create asset
  const asset = await prisma.asset.create({
    data: {
      companyId: session.companyId!,
      assetType: resolvedType,
      title: title ?? session.fileName,
      filename: session.fileName,
      originalSize: session.fileSize,
      r2Key: session.key,
      r2Bucket: process.env.R2_BUCKET_NAME!,
      mimeType: session.fileType,
      // Images are immediately READY; videos wait for Stream
      status: resolvedType === "VIDEO" ? AssetStatus.PROCESSING : AssetStatus.READY,
      uploadSource: UploadSource.NATIVE,
    },
  });

  // 4. Mark session done
  await prisma.uploadSession.update({
    where: { id: sessionId },
    data: { status: "completed" },
  });

  // 5. Enqueue video to Cloudflare Stream (HIGH = fires immediately)
  if (resolvedType === "VIDEO") {
    await enqueueAssetStreamUpload(asset.id, "HIGH");
  }

  return NextResponse.json({
    assetId: asset.id,
    status: asset.status,
    assetType: resolvedType,
  });
}