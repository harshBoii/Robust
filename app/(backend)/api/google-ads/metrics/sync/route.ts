import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { requireGoogleAdsEnv, requireGoogleCustomerId } from '@/lib/google-ads/integration-token';
import { GoogleAdsApi } from 'google-ads-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/google-ads/metrics/sync
 *
 * Pulls last_7d and last_30d performance metrics from Google Ads for every
 * published GoogleAd (those that have a googleAdId set), and upserts
 * GoogleAdMetrics snapshot rows.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = session;

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId },
    select: { id: true, refreshToken: true, customerId: true, loginCustomerId: true },
  });
  if (!integration?.refreshToken) {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });
  }

  const env = requireGoogleAdsEnv();
  const customerId = await requireGoogleCustomerId(companyId);

  const client = new GoogleAdsApi({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    developer_token: env.developerToken,
  });

  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: integration.loginCustomerId ?? undefined,
    refresh_token: integration.refreshToken,
  });

  // Fetch published GoogleAds that have a real Google ad ID
  const dbAds = await prisma.googleAd.findMany({
    where: {
      googleAdsIntegrationId: integration.id,
      googleAdId: { not: null },
    },
    select: {
      id: true,
      googleAdId: true,
      adGroup: {
        select: {
          campaign: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!dbAds.length) {
    return NextResponse.json({ ok: true, synced: 0 });
  }

  const googleAdIds = dbAds.map((a) => a.googleAdId).filter(Boolean) as string[];

  // Build date windows
  const today = new Date();
  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - offset);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const presets: { label: string; from: string; to: string }[] = [
    { label: 'last_7d', from: d(7), to: d(0) },
    { label: 'last_30d', from: d(30), to: d(0) },
  ];

  let synced = 0;

  for (const preset of presets) {
    const rows = await customer.query(`
      SELECT
        ad_group_ad.ad.id,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group_ad
      WHERE ad_group_ad.ad.id IN (${googleAdIds.join(',')})
        AND segments.date BETWEEN '${preset.from}' AND '${preset.to}'
    `).catch(() => []);

    for (const row of rows) {
      const googleAdId = String(row.ad_group_ad?.ad?.id ?? '');
      const dbAd = dbAds.find((a) => a.googleAdId === googleAdId);
      if (!dbAd) continue;

      const googleCampaignId = dbAd.adGroup?.campaign?.id ?? '';

      const clicks = Number(row.metrics?.clicks ?? 0);
      const impressions = Number(row.metrics?.impressions ?? 0);
      const costMicros = Number(row.metrics?.cost_micros ?? 0);

      await prisma.googleAdMetrics.upsert({
        where: {
          googleAdId_datePreset: {
            googleAdId,
            datePreset: preset.label,
          },
        },
        create: {
          googleCampaignId,
          googleAdId,
          impressions,
          clicks,
          ctr: impressions > 0 ? clicks / impressions : 0,
          spend: costMicros / 1_000_000,
          cpc: clicks > 0 ? costMicros / 1_000_000 / clicks : null,
          conversions: Number(row.metrics?.conversions ?? 0),
          conversionValue: Number(row.metrics?.conversions_value ?? 0),
          datePreset: preset.label,
        },
        update: {
          impressions,
          clicks,
          ctr: impressions > 0 ? clicks / impressions : 0,
          spend: costMicros / 1_000_000,
          cpc: clicks > 0 ? costMicros / 1_000_000 / clicks : null,
          conversions: Number(row.metrics?.conversions ?? 0),
          conversionValue: Number(row.metrics?.conversions_value ?? 0),
          recordedAt: new Date(),
        },
      });
      synced++;
    }
  }

  return NextResponse.json({ ok: true, synced });
}
