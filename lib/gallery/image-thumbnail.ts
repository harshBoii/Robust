import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import {
  AssetType,
  ImageThumbnailStatus,
} from "@/app/generated/prisma/enums";
import { getR2PublicObjectUrl, r2 } from "@/lib/cloudfare/r2";
import { prisma } from "@/lib/prisma";

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 360;
const THUMBNAIL_QUALITY = 78;

export type GeneratedImageThumbnail = {
  thumbnailR2Key: string;
  thumbnailUrl: string;
};

export async function generateImageThumbnail(
  assetId: string,
): Promise<GeneratedImageThumbnail> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      assetType: true,
      r2Bucket: true,
      r2Key: true,
    },
  });

  if (!asset) throw new Error("Asset not found");
  if (asset.assetType !== AssetType.IMAGE) {
    throw new Error("Only image assets support image thumbnails");
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      thumbnailStatus: ImageThumbnailStatus.PROCESSING,
      thumbnailError: null,
    },
  });

  try {
    const source = await r2.send(
      new GetObjectCommand({
        Bucket: asset.r2Bucket,
        Key: asset.r2Key,
      }),
    );
    if (!source.Body) throw new Error("Image object has no body");

    const original = await source.Body.transformToByteArray();
    const thumbnail = await sharp(original, {
      failOn: "error",
      limitInputPixels: 100_000_000,
    })
      .rotate()
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: true,
      })
      .webp({
        quality: THUMBNAIL_QUALITY,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();

    const thumbnailR2Key = `thumbnails/images/${asset.id}.webp`;
    const thumbnailUrl = getR2PublicObjectUrl(thumbnailR2Key);
    if (!thumbnailUrl) {
      throw new Error("R2_PUBLIC_BASE_URL is not configured");
    }

    await r2.send(
      new PutObjectCommand({
        Bucket: asset.r2Bucket,
        Key: thumbnailR2Key,
        Body: thumbnail,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        thumbnailR2Key,
        thumbnailUrl,
        thumbnailStatus: ImageThumbnailStatus.READY,
        thumbnailError: null,
        thumbnailGeneratedAt: new Date(),
      },
    });

    return { thumbnailR2Key, thumbnailUrl };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : "Thumbnail generation failed";
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        thumbnailStatus: ImageThumbnailStatus.ERROR,
        thumbnailError: message,
      },
    });
    throw error;
  }
}

export async function processPendingImageThumbnails(options?: {
  limit?: number;
  concurrency?: number;
}) {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const concurrency = Math.min(5, Math.max(1, options?.concurrency ?? 3));
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000);

  const assets = await prisma.asset.findMany({
    where: {
      assetType: AssetType.IMAGE,
      thumbnailR2Key: null,
      OR: [
        {
          thumbnailStatus: {
            in: [
              ImageThumbnailStatus.NOT_REQUIRED,
              ImageThumbnailStatus.PENDING,
              ImageThumbnailStatus.ERROR,
            ],
          },
        },
        {
          thumbnailStatus: ImageThumbnailStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let cursor = 0;
  const generated: string[] = [];
  const failed: Array<{ assetId: string; error: string }> = [];

  const worker = async () => {
    while (cursor < assets.length) {
      const asset = assets[cursor++];
      if (!asset) return;
      try {
        await generateImageThumbnail(asset.id);
        generated.push(asset.id);
      } catch (error) {
        failed.push({
          assetId: asset.id,
          error: error instanceof Error ? error.message : "Thumbnail generation failed",
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, assets.length) }, () => worker()),
  );

  return {
    selected: assets.length,
    generated: generated.length,
    failed: failed.length,
    failures: failed,
  };
}
