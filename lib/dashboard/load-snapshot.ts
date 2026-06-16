import 'server-only';

import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import { prisma } from '@/lib/prisma';

import { asNumber, computeCpi, daysBetweenUtc, parseMetaActions } from './row-metrics';

export type DashboardSnapshot = {
  rows: DashboardRow[];
  lastRefreshedAt: string | null;
};

/** Build table rows from the latest persisted metrics per ad (no Meta API). */
export async function loadDashboardSnapshot(
  metaIntegrationId: string,
): Promise<DashboardSnapshot> {
  const ads = await prisma.metaAd.findMany({
    where: { metaIntegrationId },
    select: {
      metaAdId: true,
      name: true,
      status: true,
      publishedAt: true,
      creative: { select: { thumbnailUrl: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!ads.length) {
    return { rows: [], lastRefreshedAt: null };
  }

  const adIds = ads.map((a) => a.metaAdId);

  const metrics = await prisma.metaAdMetrics.findMany({
    where: {
      metaAdId: { in: adIds },
      datePreset: { in: ['today', 'maximum'] },
    },
    orderBy: { recordedAt: 'desc' },
    select: {
      metaAdId: true,
      spend: true,
      clicks: true,
      ctr: true,
      hookRate: true,
      daysRunning: true,
      statusSignal: true,
      actions: true,
      datePreset: true,
      recordedAt: true,
    },
  });

  const todayByAd = new Map<string, (typeof metrics)[number]>();
  const maxByAd = new Map<string, (typeof metrics)[number]>();
  let lastRefreshedAt: Date | null = null;

  for (const m of metrics) {
    if (!lastRefreshedAt || m.recordedAt > lastRefreshedAt) {
      lastRefreshedAt = m.recordedAt;
    }
    if (m.datePreset === 'today' && !todayByAd.has(m.metaAdId)) {
      todayByAd.set(m.metaAdId, m);
    }
    if (m.datePreset === 'maximum' && !maxByAd.has(m.metaAdId)) {
      maxByAd.set(m.metaAdId, m);
    }
  }

  const now = new Date();

  const rows: DashboardRow[] = ads.map((ad) => {
    const t = todayByAd.get(ad.metaAdId);
    const max = maxByAd.get(ad.metaAdId);
    const actions = parseMetaActions(max?.actions);
    const spendToday = t?.spend ?? 0;
    const spendTotal = max?.spend ?? spendToday;
    const clicks = max?.clicks ?? t?.clicks ?? 0;
    const ctr = max?.ctr ?? t?.ctr ?? 0;
    const cpi = computeCpi({ spend: spendTotal, actions, clicks });
    const hookRate =
      typeof max?.hookRate === 'number'
        ? max.hookRate
        : typeof t?.hookRate === 'number'
          ? t.hookRate
          : null;

    const daysRunning =
      max?.daysRunning ??
      (ad.publishedAt ? daysBetweenUtc(ad.publishedAt, now) : null);

    const statusSignal = (max?.statusSignal ?? t?.statusSignal) as DashboardRow['statusSignal'];

    return {
      adId: ad.metaAdId,
      name: ad.name ?? ad.metaAdId,
      status: ad.status,
      thumbnailUrl: ad.creative?.thumbnailUrl ?? null,
      spendToday,
      spendTotal,
      cpi,
      ctr,
      hookRate,
      daysRunning,
      publishedAt: ad.publishedAt?.toISOString() ?? null,
      statusSignal: statusSignal ?? null,
    };
  });

  return {
    rows,
    lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
  };
}
