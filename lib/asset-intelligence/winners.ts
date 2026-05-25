import 'server-only';

import { prisma } from '@/lib/prisma';

export type WinningMetaAdRow = {
  metaAdDbId: string;
  metaAdId: string;
  adName: string | null;
  spend: number;
  hasLinkedAsset: boolean;
  assetId: string | null;
};

export class WinnersQueryError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = 'WinnersQueryError';
  }
}

/** Ads for a signal tier from DB metrics (requires prior dashboard refresh). */
export async function listMetaAdsBySignal(
  companyId: string,
  statusSignal: string,
  limit = 10,
): Promise<WinningMetaAdRow[]> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });

  if (!integration) {
    throw new WinnersQueryError('Meta integration not connected', 400);
  }

  const metrics = await prisma.metaAdMetrics.findMany({
    where: {
      statusSignal,
      datePreset: 'maximum',
    },
    orderBy: [{ spend: 'desc' }, { recordedAt: 'desc' }],
    take: 100,
    select: {
      metaAdId: true,
      spend: true,
    },
  });

  if (!metrics.length) {
    return [];
  }

  const metaAdIds = metrics.map((m) => m.metaAdId);
  const ads = await prisma.metaAd.findMany({
    where: {
      metaIntegrationId: integration.id,
      metaAdId: { in: metaAdIds },
    },
    select: {
      id: true,
      metaAdId: true,
      name: true,
      creative: { select: { assetId: true } },
    },
  });

  const adByMetaId = new Map(ads.map((a) => [a.metaAdId, a]));
  const rows: WinningMetaAdRow[] = [];
  const seen = new Set<string>();

  for (const m of metrics) {
    const ad = adByMetaId.get(m.metaAdId);
    if (!ad || seen.has(ad.metaAdId)) continue;
    seen.add(ad.metaAdId);
    const assetId = ad.creative?.assetId ?? null;
    rows.push({
      metaAdDbId: ad.id,
      metaAdId: ad.metaAdId,
      adName: ad.name,
      spend: m.spend,
      hasLinkedAsset: Boolean(assetId),
      assetId,
    });
    if (rows.length >= limit) break;
  }

  return rows;
}

/** Winning ads from DB metrics (requires prior dashboard refresh). */
export async function listWinningMetaAds(
  companyId: string,
  limit = 10,
): Promise<WinningMetaAdRow[]> {
  const rows = await listMetaAdsBySignal(companyId, 'WINNER', limit);

  if (!rows.length) {
    throw new WinnersQueryError(
      'No winning ads found. Refresh the dashboard to sync Meta performance data.',
      400,
    );
  }

  return rows;
}
