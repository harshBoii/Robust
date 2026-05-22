import 'server-only';

import { generatePresignedUrl, getR2PublicObjectUrl } from '@/lib/cloudfare/r2';
import { prisma } from '@/lib/prisma';

import type { ImageGenState } from './types';

/** Resolve a fetchable image URL for an asset (public R2, presigned, or stored thumbnail). */
export async function resolveAssetImageUrl(
  companyId: string,
  assetId: string,
  cachedUrl?: string | null,
): Promise<string | null> {
  if (cachedUrl?.trim()) return cachedUrl.trim();

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId },
    select: { thumbnailUrl: true, r2Key: true, r2Bucket: true },
  });
  if (!asset) return null;
  if (asset.thumbnailUrl?.trim()) return asset.thumbnailUrl.trim();

  const publicUrl = getR2PublicObjectUrl(asset.r2Key);
  if (publicUrl) return publicUrl;

  try {
    return await generatePresignedUrl(asset.r2Key, asset.r2Bucket);
  } catch {
    return null;
  }
}

export async function resolveTemplateReferenceUrls(
  companyId: string,
  ig: ImageGenState,
): Promise<string[]> {
  if (ig.productImageUrl?.trim()) return [ig.productImageUrl.trim()];
  if (!ig.productImageAssetId) return [];
  const url = await resolveAssetImageUrl(companyId, ig.productImageAssetId);
  return url ? [url] : [];
}
