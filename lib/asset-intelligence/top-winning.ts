import 'server-only';

import type { AssetType } from '@/app/generated/prisma/client';
import { getAppOrigin } from '@/lib/app-origin';
import { prisma } from '@/lib/prisma';

import type { TopWinningAsset } from './types';
import { listWinningMetaAds, WinnersQueryError } from './winners';

const REQUIRED_COUNT = 3;

export { WinnersQueryError as TopWinningError };

function buildDownloadUrl(origin: string, assetId: string, assetType: AssetType): string {
  const base = origin.replace(/\/$/, '');
  if (assetType === 'VIDEO') {
    return `${base}/api/videos/${assetId}/download`;
  }
  return `${base}/api/assets/${assetId}/download`;
}

export async function getTopWinningAssets(companyId: string): Promise<TopWinningAsset[]> {
  const winners = await listWinningMetaAds(companyId, 20);

  const orderedAssetIds: string[] = [];
  const seen = new Set<string>();

  for (const w of winners) {
    if (!w.assetId || !w.hasLinkedAsset || seen.has(w.assetId)) continue;
    seen.add(w.assetId);
    orderedAssetIds.push(w.assetId);
    if (orderedAssetIds.length >= REQUIRED_COUNT) break;
  }

  if (orderedAssetIds.length < REQUIRED_COUNT) {
    throw new WinnersQueryError(
      `Only ${orderedAssetIds.length} winning ad(s) with gallery assets found (need ${REQUIRED_COUNT}). Run “Link creatives” or publish matching assets from Robust.`,
      400,
    );
  }

  const assets = await prisma.asset.findMany({
    where: {
      id: { in: orderedAssetIds },
      companyId,
      status: 'READY',
    },
    select: { id: true, assetType: true },
  });

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const origin = getAppOrigin();
  const result: TopWinningAsset[] = [];

  for (const assetId of orderedAssetIds) {
    const asset = assetById.get(assetId);
    if (!asset) {
      throw new WinnersQueryError(
        `Winning asset ${assetId} is missing or not READY in gallery.`,
        400,
      );
    }
    result.push({
      assetId: asset.id,
      mediaType: asset.assetType,
      downloadUrl: buildDownloadUrl(origin, asset.id, asset.assetType),
    });
  }

  return result;
}
