import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { enqueueGoogleBulkPublish } from '@/lib/google-ads/process-publish-jobs';
import { googleAdsErrorFromUnknown } from '@/lib/google-ads/errors';

export const dynamic = 'force-dynamic';

type GroupInput = {
  assetIds?: unknown;
  adGroupId?: unknown;
  assetGroupId?: unknown;
  headlines?: unknown;
  descriptions?: unknown;
  longHeadline?: unknown;
  finalUrl?: unknown;
  googleCreativeDbId?: unknown;
};

type Body = {
  campaignId?: unknown;
  campaignType?: unknown;
  scheduledAt?: unknown;
  groups?: unknown;
};

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  const campaignType = typeof body.campaignType === 'string' ? body.campaignType : 'DISPLAY';
  const scheduledAt = parseIsoDate(body.scheduledAt);

  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
  if (!Array.isArray(body.groups) || body.groups.length === 0) {
    return NextResponse.json({ error: 'Missing or empty groups' }, { status: 400 });
  }

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });

  // Verify campaign belongs to this company
  const campaign = await prisma.googleCampaign.findFirst({
    where: { id: campaignId, googleAdsIntegrationId: integration.id },
    select: { id: true, campaignType: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const rawGroups = body.groups as GroupInput[];
  const groups = rawGroups.map((g) => ({
    assetIds: Array.isArray(g.assetIds)
      ? (g.assetIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    adGroupId: typeof g.adGroupId === 'string' ? g.adGroupId : undefined,
    assetGroupId: typeof g.assetGroupId === 'string' ? g.assetGroupId : undefined,
    headlines: Array.isArray(g.headlines)
      ? (g.headlines as unknown[]).filter((h): h is string => typeof h === 'string')
      : undefined,
    descriptions: Array.isArray(g.descriptions)
      ? (g.descriptions as unknown[]).filter((d): d is string => typeof d === 'string')
      : undefined,
    longHeadline: typeof g.longHeadline === 'string' ? g.longHeadline : undefined,
    finalUrl: typeof g.finalUrl === 'string' ? g.finalUrl : undefined,
    googleCreativeDbId: typeof g.googleCreativeDbId === 'string' ? g.googleCreativeDbId : undefined,
  }));

  try {
    const jobIds = await enqueueGoogleBulkPublish({
      companyId: session.companyId,
      googleAdsIntegrationId: integration.id,
      campaignId,
      campaignType: campaign.campaignType,
      scheduledAt,
      groups,
    });

    return NextResponse.json({ jobIds });
  } catch (err) {
    const { status, error } = googleAdsErrorFromUnknown(err);
    return NextResponse.json({ error }, { status });
  }
}
