import 'server-only';

import type { AssetType } from '@/app/generated/prisma/client';
import { getAppOrigin } from '@/lib/app-origin';
import { prisma } from '@/lib/prisma';

import type { TopWinningAsset } from './types';

const REQUIRED_COUNT = 3;

function buildDownloadUrl(origin: string, assetId: string, assetType: AssetType): string {
  const base = origin.replace(/\/$/, '');
  if (assetType === 'VIDEO') {
    return `${base}/api/videos/${assetId}/download`;
  }
  return `${base}/api/assets/${assetId}/download`;
}

export class TopWinningError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = 'TopWinningError';
  }
}

export async function getTopWinningAssets(companyId: string): Promise<TopWinningAsset[]> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });

  if (!integration) {
    throw new TopWinningError('Meta integration not connected', 400);
  }

  const ads = await prisma.metaAd.findMany({
    where: {
      metaIntegrationId: integration.id,
      creative: { assetId: { not: null } },
    },
    select: {
      metaAdId: true,
      creative: { select: { assetId: true } },
    },
  });

  if (!ads.length) {
    throw new TopWinningError(
      'No linked gallery assets on Meta ads. Publish creatives with assets first.',
      400,
    );
  }

  const adIdToAssetId = new Map<string, string>();
  for (const ad of ads) {
    const assetId = ad.creative?.assetId;
    if (assetId) adIdToAssetId.set(ad.metaAdId, assetId);
  }

  const metrics = await prisma.metaAdMetrics.findMany({
    where: {
      metaAdId: { in: [...adIdToAssetId.keys()] },
      statusSignal: 'WINNER',
      datePreset: 'maximum',
    },
    orderBy: [{ spend: 'desc' }, { recordedAt: 'desc' }],
  });

  if (!metrics.length) {
    throw new TopWinningError(
      'No winning ads found. Refresh the dashboard to sync Meta performance data.',
      400,
    );
  }

  const orderedAssetIds: string[] = [];
  const seen = new Set<string>();
  for (const m of metrics) {
    const assetId = adIdToAssetId.get(m.metaAdId);
    if (!assetId || seen.has(assetId)) continue;
    seen.add(assetId);
    orderedAssetIds.push(assetId);
    if (orderedAssetIds.length >= REQUIRED_COUNT) break;
  }

  if (orderedAssetIds.length < REQUIRED_COUNT) {
    throw new TopWinningError(
      `Only ${orderedAssetIds.length} winning ad(s) with gallery assets found (need ${REQUIRED_COUNT}). Refresh dashboard or adjust winner rules.`,
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
      throw new TopWinningError(
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
