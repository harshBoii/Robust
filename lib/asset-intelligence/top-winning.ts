import 'server-only';

import type { AssetType } from '@/app/generated/prisma/client';
import { getAppOrigin } from '@/lib/app-origin';
import { prisma } from '@/lib/prisma';

import { isAssetReadyForIntelligence } from './asset-ready';
import { pickVideoAssetIdsForAnalysis } from './select-video-ads';
import type { TopWinningAsset } from './types';
import { WinnersQueryError } from './winners';

export { WinnersQueryError as TopWinningError };

function buildDownloadUrl(origin: string, assetId: string, assetType: AssetType): string {
  const base = origin.replace(/\/$/, '');
  if (assetType === 'VIDEO') {
    return `${base}/api/videos/${assetId}/download`;
  }
  return `${base}/api/assets/${assetId}/download`;
}

/** Top video ads for analysis: WINNER → FATIGUE → UNDERPERFORMER (max 3, min 1). */
export async function getTopWinningAssets(companyId: string): Promise<TopWinningAsset[]> {
  const orderedAssetIds = await pickVideoAssetIdsForAnalysis(companyId);

  const assets = await prisma.asset.findMany({
    where: {
      id: { in: orderedAssetIds },
      companyId,
      assetType: 'VIDEO',
    },
    select: { id: true, assetType: true, status: true, r2Key: true },
  });

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const origin = getAppOrigin();
  const result: TopWinningAsset[] = [];

  for (const assetId of orderedAssetIds) {
    const asset = assetById.get(assetId);
    if (!asset || !isAssetReadyForIntelligence(asset)) {
      throw new WinnersQueryError(
        `Video asset ${assetId} is missing or not ready for download.`,
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
