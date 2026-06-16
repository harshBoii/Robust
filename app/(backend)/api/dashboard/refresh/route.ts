import { NextResponse } from 'next/server';

import {
  asNumber,
  computeCpi,
  computeHookRateFromVideo,
  daysBetweenUtc,
  type MetaActionRow,
} from '@/lib/dashboard/row-metrics';
import { syncAdThumbnailsFromRefresh } from '@/lib/dashboard/sync-ad-thumbnails';
import { getAdsWithInsights } from '@/lib/meta/client';
import { getSession } from '@/lib/auth/session';
import { requireMetaAdAccountId } from '@/lib/meta/integration-token';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RuleRow = {
  ruleType:
    | 'AUTO_PAUSE'
    | 'FATIGUE_ALERT'
    | 'BUDGET_PACING'
    | 'SPEND_CONCENTRATION'
    | 'WINNER_AMPLIFICATION';
  isEnabled: boolean;
  threshold: number | null;
  window: number | null;
  requiresApproval: boolean;
};

function ymd(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getRule(
  rules: RuleRow[],
  ruleType: RuleRow['ruleType'],
): RuleRow | null {
  return rules.find((r) => r.ruleType === ruleType) ?? null;
}

function computeStatusSignal(input: {
  cpi: number | null;
  ctr: number;
  ctrPrev7d: number | null;
  rules: RuleRow[];
}) {
  const fatigueRule = getRule(input.rules, 'FATIGUE_ALERT');
  const autoPauseRule = getRule(input.rules, 'AUTO_PAUSE');
  const winnerRule = getRule(input.rules, 'WINNER_AMPLIFICATION');

  const fatigue =
    fatigueRule?.isEnabled &&
    input.ctrPrev7d !== null &&
    input.ctrPrev7d > 0 &&
    input.ctr < input.ctrPrev7d * 0.7;

  const underperformer =
    autoPauseRule?.isEnabled &&
    input.cpi !== null &&
    typeof autoPauseRule.threshold === 'number' &&
    autoPauseRule.threshold > 0 &&
    input.cpi > autoPauseRule.threshold;

  const winner =
    winnerRule?.isEnabled &&
    input.cpi !== null &&
    typeof winnerRule.threshold === 'number' &&
    winnerRule.threshold > 0 &&
    input.cpi < winnerRule.threshold * 0.8 &&
    input.ctrPrev7d !== null &&
    input.ctrPrev7d > 0 &&
    input.ctr > input.ctrPrev7d;

  if (winner) return 'WINNER';
  if (underperformer) return 'UNDERPERFORMER';
  if (fatigue) return 'FATIGUE';
  return null;
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metaIntegration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: {
      id: true,
      adAccountId: true,
    },
  });

  if (!metaIntegration) {
    return NextResponse.json(
      { error: 'Meta integration not connected' },
      { status: 400 },
    );
  }

  let adAccountId: string;
  try {
    adAccountId = requireMetaAdAccountId(metaIntegration.adAccountId);
  } catch {
    return NextResponse.json(
      { error: 'Configure ad account in workspace settings' },
      { status: 400 },
    );
  }

  const rules = (await prisma.adAutomationRule.findMany({
    where: { companyId: session.companyId },
    select: {
      ruleType: true,
      isEnabled: true,
      threshold: true,
      window: true,
      requiresApproval: true,
    },
  })) as RuleRow[];

  const todayAds = await getAdsWithInsights({
    companyId: session.companyId,
    adAccountId,
    datePreset: 'today',
  });

  const maximumAds = await getAdsWithInsights({
    companyId: session.companyId,
    adAccountId,
    datePreset: 'maximum',
  });

  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
  const last7dAds = await getAdsWithInsights({
    companyId: session.companyId,
    adAccountId,
    datePreset: 'last_7d',
    timeIncrement: 1,
    timeRange: { since: ymd(since), until: ymd(now) },
  });

  const byId = new Map<string, { today?: (typeof todayAds)[number]; maximum?: (typeof maximumAds)[number]; last7d?: (typeof last7dAds)[number] }>();
  for (const a of todayAds) byId.set(a.id, { ...(byId.get(a.id) ?? {}), today: a });
  for (const a of maximumAds) byId.set(a.id, { ...(byId.get(a.id) ?? {}), maximum: a });
  for (const a of last7dAds) byId.set(a.id, { ...(byId.get(a.id) ?? {}), last7d: a });

  const rows = Array.from(byId.entries()).map(([adId, v]) => {
    const tRow = v.today?.insights?.data?.[0];
    const maxRow = v.maximum?.insights?.data?.[0];

    // Prefer maximum for lifetime-ish metrics, but fall back to today if missing.
    const spendToday = asNumber(tRow?.spend);
    const spendTotal = asNumber(maxRow?.spend);
    const impressions = Math.trunc(asNumber(maxRow?.impressions || tRow?.impressions));
    const clicks = Math.trunc(asNumber(maxRow?.clicks || tRow?.clicks));
    const ctr = asNumber(maxRow?.ctr || tRow?.ctr);
    const cpi = computeCpi({
      spend: spendTotal,
      actions: maxRow?.actions as MetaActionRow[] | undefined,
      clicks,
    });

    // Hook rate is only present for video ads; sometimes maximum omits video actions.
    const hookRate =
      computeHookRateFromVideo({
        impressions: Math.trunc(asNumber(maxRow?.impressions)),
        video2s: maxRow?.video_continuous_2_sec_watched_actions as MetaActionRow[] | undefined,
      }) ??
      computeHookRateFromVideo({
        impressions: Math.trunc(asNumber(tRow?.impressions)),
        video2s: tRow?.video_continuous_2_sec_watched_actions as MetaActionRow[] | undefined,
      });

    const l7 = v.last7d?.insights?.data?.[0];
    const ctrPrev7d = l7 ? asNumber(l7.ctr) : null;

    const statusSignal = computeStatusSignal({ cpi, ctr, ctrPrev7d, rules });

    // Prefer maximum data for campaign/adset details, fall back to today/last7d
    const src = v.maximum ?? v.today ?? v.last7d;
    const campaignData = src?.campaign;
    const adSetData = src?.adset;

    const createdTimeIso = src?.created_time ?? null;
    const publishedAt = createdTimeIso ? new Date(createdTimeIso) : null;
    const daysRunning = publishedAt ? daysBetweenUtc(publishedAt, now) : null;

    return {
      adId,
      name: src?.name ?? '',
      status: src?.status ?? null,
      thumbnailUrl: src?.creative?.thumbnail_url ?? null,
      metaCreativeId: src?.creative?.id ?? null,
      campaignId: src?.campaign_id ?? null,
      campaignName: campaignData?.name ?? src?.campaign_id ?? null,
      campaignObjective: campaignData?.objective ?? 'UNKNOWN',
      campaignStatus: campaignData?.status ?? 'ACTIVE',
      campaignDailyBudget: asNumber(campaignData?.daily_budget),
      adSetId: src?.adset_id ?? null,
      adSetName: adSetData?.name ?? src?.adset_id ?? null,
      adSetStatus: adSetData?.status ?? 'ACTIVE',
      adSetDailyBudget: asNumber(adSetData?.daily_budget),
      spendToday,
      spendTotal,
      impressions,
      clicks,
      ctr,
      cpi,
      hookRate,
      daysRunning,
      statusSignal,
      actions: maxRow?.actions ?? tRow?.actions ?? [],
      createdTimeIso,
      publishedAt: createdTimeIso,
      recordedAt: new Date().toISOString(),
    };
  });

  // ── Sync Meta structure to DB: Campaign → AdSet → Ad ──────────────────────
  // 1. Collect unique campaigns and adsets
  const campaignMap = new Map<string, { name: string; objective: string; status: string; dailyBudget: number }>();
  const adSetMap = new Map<string, { metaCampaignId: string; name: string; status: string; dailyBudget: number }>();

  for (const r of rows) {
    if (r.campaignId && !campaignMap.has(r.campaignId)) {
      campaignMap.set(r.campaignId, {
        name: r.campaignName ?? r.campaignId,
        objective: r.campaignObjective,
        status: r.campaignStatus,
        dailyBudget: r.campaignDailyBudget,
      });
    }
    if (r.adSetId && r.campaignId && !adSetMap.has(r.adSetId)) {
      adSetMap.set(r.adSetId, {
        metaCampaignId: r.campaignId,
        name: r.adSetName ?? r.adSetId,
        status: r.adSetStatus,
        dailyBudget: r.adSetDailyBudget,
      });
    }
  }

  // 2. Upsert campaigns (no FK dependency)
  await Promise.all(
    Array.from(campaignMap.entries()).map(([metaCampaignId, data]) =>
      prisma.metaCampaign.upsert({
        where: {
          metaIntegrationId_metaCampaignId: {
            metaIntegrationId: metaIntegration.id,
            metaCampaignId,
          },
        },
        create: {
          metaIntegrationId: metaIntegration.id,
          metaCampaignId,
          name: data.name,
          objective: data.objective,
          status: data.status,
          dailyBudget: data.dailyBudget,
        },
        update: {
          name: data.name,
          status: data.status,
          dailyBudget: data.dailyBudget,
        },
      }),
    ),
  );

  // 3. Fetch DB IDs for campaigns we just upserted
  const dbCampaigns = await prisma.metaCampaign.findMany({
    where: {
      metaIntegrationId: metaIntegration.id,
      metaCampaignId: { in: Array.from(campaignMap.keys()) },
    },
    select: { id: true, metaCampaignId: true },
  });
  const campaignDbIdMap = new Map(dbCampaigns.map((c) => [c.metaCampaignId, c.id]));

  // 4. Upsert adsets (depend on campaign DB IDs)
  await Promise.all(
    Array.from(adSetMap.entries()).map(([metaAdSetId, data]) => {
      const campaignDbId = campaignDbIdMap.get(data.metaCampaignId);
      if (!campaignDbId) return Promise.resolve();
      return prisma.metaAdSet.upsert({
        where: {
          metaIntegrationId_metaAdSetId: {
            metaIntegrationId: metaIntegration.id,
            metaAdSetId,
          },
        },
        create: {
          metaIntegrationId: metaIntegration.id,
          campaignId: campaignDbId,
          metaAdSetId,
          name: data.name,
          status: data.status,
          dailyBudget: data.dailyBudget,
        },
        update: {
          name: data.name,
          status: data.status,
          dailyBudget: data.dailyBudget,
        },
      });
    }),
  );

  // 5. Fetch DB IDs for adsets we just upserted
  const dbAdSets = await prisma.metaAdSet.findMany({
    where: {
      metaIntegrationId: metaIntegration.id,
      metaAdSetId: { in: Array.from(adSetMap.keys()) },
    },
    select: { id: true, metaAdSetId: true },
  });
  const adSetDbIdMap = new Map(dbAdSets.map((a) => [a.metaAdSetId, a.id]));

  // 6. Upsert ads (depend on adset DB IDs)
  await Promise.all(
    rows.map((r) => {
      if (!r.adSetId) return Promise.resolve();
      const adSetDbId = adSetDbIdMap.get(r.adSetId);
      if (!adSetDbId) return Promise.resolve();
      return prisma.metaAd.upsert({
        where: {
          metaIntegrationId_metaAdId: {
            metaIntegrationId: metaIntegration.id,
            metaAdId: r.adId,
          },
        },
        create: {
          metaIntegrationId: metaIntegration.id,
          adSetId: adSetDbId,
          metaAdId: r.adId,
          name: r.name,
          status: r.status,
          publishedAt: r.createdTimeIso ? new Date(r.createdTimeIso) : null,
        },
        update: {
          name: r.name,
          status: r.status,
          publishedAt: r.createdTimeIso ? new Date(r.createdTimeIso) : undefined,
        },
      });
    }),
  );

  await syncAdThumbnailsFromRefresh(
    metaIntegration.id,
    rows.map((r) => ({
      adId: r.adId,
      name: r.name,
      thumbnailUrl: r.thumbnailUrl,
      metaCreativeId: r.metaCreativeId,
    })),
  );

  // ── Persist modeled metrics (today + maximum) ─────────────────────────────
  const metricsData = rows.flatMap((r) => {
    const metaCampaignId = r.campaignId ?? 'unknown';
    const base = {
      metaCampaignId,
      metaAdId: r.adId,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      cpc: r.clicks > 0 ? r.spendTotal / r.clicks : null,
      roas: null as number | null,
      hookRate: r.hookRate,
      daysRunning: r.daysRunning,
      statusSignal: r.statusSignal,
      actions: r.actions as unknown as object,
    };

    return [
      { ...base, datePreset: 'today', spend: r.spendToday },
      { ...base, datePreset: 'maximum', spend: r.spendTotal },
    ];
  });

  if (metricsData.length) {
    await prisma.metaAdMetrics.createMany({ data: metricsData });
  }

  return NextResponse.json({ rows });
}

