import 'server-only';

import { AssetStatus, AssetType } from '@/app/generated/prisma/enums';
import { generatePresignedUrl, getR2PublicObjectUrl } from '@/lib/cloudfare/r2';
import { prisma } from '@/lib/prisma';

type AssetUrlFields = {
  r2Key: string;
  r2Bucket: string;
};

export async function resolveAssetDisplayUrl(asset: AssetUrlFields): Promise<string> {
  const publicUrl = getR2PublicObjectUrl(asset.r2Key);
  if (publicUrl) return publicUrl;
  return generatePresignedUrl(asset.r2Key, asset.r2Bucket);
}

export async function resolveLogoUrlFromAssetId(
  companyId: string,
  assetId: string,
): Promise<string> {
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      companyId,
      assetType: AssetType.IMAGE,
      status: AssetStatus.READY,
    },
    select: {
      r2Key: true,
      r2Bucket: true,
    },
  });

  if (!asset) {
    throw new Error('Image not found or not ready');
  }

  return resolveAssetDisplayUrl(asset);
}

export async function listLogoAssetCandidates(companyId: string) {
  return prisma.asset.findMany({
    where: {
      companyId,
      assetType: AssetType.IMAGE,
      status: AssetStatus.READY,
    },
    orderBy: { createdAt: 'desc' },
    take: 120,
    select: {
      id: true,
      title: true,
      filename: true,
      thumbnailUrl: true,
      createdAt: true,
    },
  });
}
