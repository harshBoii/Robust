import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2PublicObjectUrl, r2 } from "@/lib/cloudfare/r2";
import { prisma } from "@/lib/prisma";
import { enqueueAssetStreamUpload } from "@/lib/cloudfare/stream";
import { maybeAnalyzeBulkUpload } from "@/lib/gallery/analyze-bulk";
import {
  AssetType,
  AssetStatus,
  BulkUploadStatus,
  UploadSource,
} from "@/app/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { sessionId, parts, assetType, title } = await req.json();

  const session = await prisma.uploadSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  let bulkUploadId: string | undefined;
  if (session.metadata) {
    try {
      const meta = JSON.parse(session.metadata) as { bulkUploadId?: string };
      if (typeof meta.bulkUploadId === "string" && meta.bulkUploadId) {
        const bulk = await prisma.bulkUpload.findFirst({
          where: {
            id: meta.bulkUploadId,
            companyId: session.companyId ?? "",
          },
          select: { id: true },
        });
        if (bulk) bulkUploadId = bulk.id;
      }
    } catch {
      /* ignore invalid metadata */
    }
  }

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

  const publicPreviewUrl =
    resolvedType === "IMAGE" ? getR2PublicObjectUrl(session.key) : null;

  // 3. Create asset
  const asset = await prisma.asset.create({
    data: {
      companyId: session.companyId!,
      ...(bulkUploadId ? { bulkUploadId } : {}),
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
      ...(publicPreviewUrl ? { thumbnailUrl: publicPreviewUrl } : {}),
    },
  });

  // 4. Mark session done
  await prisma.uploadSession.update({
    where: { id: sessionId },
    data: { status: "completed" },
  });

  if (bulkUploadId) {
    await prisma.bulkUpload.update({
      where: { id: bulkUploadId },
      data: { status: BulkUploadStatus.READY },
    });
    void maybeAnalyzeBulkUpload(bulkUploadId);
  }

  // 5. Enqueue video to Cloudflare Stream (HIGH = fires immediately)
  if (resolvedType === "VIDEO") {
    await enqueueAssetStreamUpload(asset.id, "HIGH");
  }

  return NextResponse.json({
    assetId: asset.id,
    status: asset.status,
    assetType: resolvedType,
    thumbnailUrl: asset.thumbnailUrl ?? null,
  });
}