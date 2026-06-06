import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/google-ads/metrics/summary?datePreset=last_30d
 *
 * Returns aggregate impressions, clicks, spend, and conversions for a given
 * datePreset across all ads for the company.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = session;
  const datePreset = req.nextUrl.searchParams.get('datePreset') ?? 'last_30d';

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });
  }

  const campaigns = await prisma.googleCampaign.findMany({
    where: { googleAdsIntegrationId: integration.id },
    select: { id: true },
  });

  const campaignIds = campaigns.map((c) => c.id);

  const rows = await prisma.googleAdMetrics.findMany({
    where: {
      googleCampaignId: { in: campaignIds },
      datePreset,
    },
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.spend += r.spend;
      acc.conversions += r.conversions ?? 0;
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
  );

  return NextResponse.json({
    datePreset,
    ...totals,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
  });
}
