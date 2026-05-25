import type { AssetStatus, AssetType } from '@/app/generated/prisma/client';

/** Gallery asset can be sent to Asset Intelligence (R2 bytes available). */
export function isAssetReadyForIntelligence(asset: {
  status: AssetStatus;
  assetType: AssetType;
  r2Key: string | null;
}): boolean {
  if (!asset.r2Key?.trim()) return false;
  if (asset.status === 'READY') return true;
  if (asset.assetType === 'VIDEO' && asset.status === 'PROCESSING') return true;
  return false;
}
