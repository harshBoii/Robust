import { prisma } from "@/lib/prisma";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { r2 } from "@/lib/cloudfare/r2";
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { fileName, fileSize, fileType, totalParts, companyId, bulkUploadId } = body;
  
    if (!fileName || !fileSize || !fileType || !companyId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
  
    const ext = fileName.split(".").pop() ?? "bin";
    const r2Key = `uploads/${companyId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  
    const { UploadId } = await r2.send(
      new CreateMultipartUploadCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: r2Key,
        ContentType: fileType,
      })
    );
  
    // 🛡️ Log the actual length so you can catch future overflows early
    console.log(`[upload/start] UploadId length: ${UploadId?.length}`);
  
    const session = await prisma.uploadSession.create({
      data: {
        uploadId: UploadId!,
        key: r2Key,
        fileName: fileName.slice(0, 500),     // guard
        fileSize: BigInt(fileSize),
        fileType: fileType.slice(0, 200),
        totalParts,
        status: "pending",
        companyId,
        metadata: bulkUploadId
          ? JSON.stringify({ bulkUploadId })
          : undefined,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  
    return NextResponse.json({
      sessionId: session.id,
      uploadId: UploadId,
      r2Key,
    });
  }