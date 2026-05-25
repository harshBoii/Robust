import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { r2 } from '@/lib/cloudfare/r2';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const downloadQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(60).max(604800).default(3600),
  responseContentType: z.string().optional(),
  responseContentDisposition: z.string().default('attachment'),
  filename: z.string().optional(),
});

function formatBytes(bytes: bigint | number): string {
  if (!bytes) return '0 B';
  const value = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(value) / Math.log(k));
  return `${parseFloat((value / k ** i).toFixed(2))} ${sizes[i]}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assetId } = await params;

    if (!assetId) {
      return NextResponse.json(
        { success: false, error: 'Missing asset ID' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const queryObject = Object.fromEntries(searchParams.entries());
    const validation = downloadQuerySchema.safeParse(queryObject);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.format(),
        },
        { status: 400 },
      );
    }

    const {
      expiresIn,
      responseContentType,
      responseContentDisposition,
      filename,
    } = validation.data;

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        title: true,
        filename: true,
        r2Key: true,
        r2Bucket: true,
        originalSize: true,
        mimeType: true,
        assetType: true,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }

    const baseFilename =
      filename ??
      asset.filename ??
      `asset-${asset.id}.${asset.assetType === 'VIDEO' ? 'mp4' : 'bin'}`;
    const sanitizedFilename = baseFilename.replace(/["\\]/g, '');

    const getObjectCommand = new GetObjectCommand({
      Bucket: asset.r2Bucket,
      Key: asset.r2Key,
      ResponseContentType:
        responseContentType || asset.mimeType || 'application/octet-stream',
      ResponseContentDisposition: `${responseContentDisposition}; filename="${sanitizedFilename}"`,
    });

    const presignedUrl = await getSignedUrl(r2, getObjectCommand, {
      expiresIn,
    });

    const formattedSize = formatBytes(asset.originalSize);

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        title: asset.title,
        filename: asset.filename,
        size: asset.originalSize.toString(),
        formattedSize,
        assetType: asset.assetType,
      },
      download: {
        url: presignedUrl,
        expiresIn,
        filename: sanitizedFilename,
      },
    });
  } catch (error) {
    console.error('[ASSET_DOWNLOAD_ERROR]', error);
    const err = error as Error;
    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        message: err.message,
      },
      { status: 500 },
    );
  }
}
