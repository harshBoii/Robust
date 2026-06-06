import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { googleAdsErrorFromUnknown } from '@/lib/google-ads/errors';
import { createGoogleAssetGroup } from '@/lib/google-ads/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ assetGroups: [] });

  const assetGroups = await prisma.googleAssetGroup.findMany({
    where: { campaignId, googleAdsIntegrationId: integration.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ assetGroups });
}

type PostBody = {
  campaignId?: unknown;
  name?: unknown;
  finalUrl?: unknown;
  path1?: unknown;
  path2?: unknown;
  headlines?: unknown;
  longHeadline?: unknown;
  descriptions?: unknown;
  businessName?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true, customerId: true, loginCustomerId: true, refreshToken: true },
  });
  if (!integration?.customerId) {
    return NextResponse.json({ error: 'Google Ads not connected or customer ID missing' }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  const finalUrl = typeof body.finalUrl === 'string' ? body.finalUrl.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : 'New Asset Group';
  if (!campaignId || !finalUrl) {
    return NextResponse.json({ error: 'Missing campaignId or finalUrl' }, { status: 400 });
  }

  const campaign = await prisma.googleCampaign.findFirst({
    where: { id: campaignId, googleAdsIntegrationId: integration.id },
    select: { googleCampaignId: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const headlines = Array.isArray(body.headlines)
    ? (body.headlines as unknown[]).filter((h): h is string => typeof h === 'string')
    : [];
  const descriptions = Array.isArray(body.descriptions)
    ? (body.descriptions as unknown[]).filter((d): d is string => typeof d === 'string')
    : [];
  const longHeadline = typeof body.longHeadline === 'string' ? body.longHeadline : headlines[0] ?? '';
  const businessName = typeof body.businessName === 'string' ? body.businessName : '';

  const campaignResourceName = `customers/${integration.customerId}/campaigns/${campaign.googleCampaignId}`;

  try {
    const { id: assetGroupGoogleId } = await createGoogleAssetGroup({
      refreshToken: integration.refreshToken,
      customerId: integration.customerId,
      loginCustomerId: integration.loginCustomerId,
      campaignResourceName,
      assetGroup: {
        campaignResourceName,
        name,
        finalUrl,
        path1: typeof body.path1 === 'string' ? body.path1 : undefined,
        path2: typeof body.path2 === 'string' ? body.path2 : undefined,
        headlines,
        longHeadline,
        descriptions: descriptions.length ? descriptions : ['Learn more'],
        businessName,
      },
    });

    const assetGroup = await prisma.googleAssetGroup.create({
      data: {
        googleAdsIntegrationId: integration.id,
        campaignId,
        googleAssetGroupId: assetGroupGoogleId,
        status: 'PAUSED',
        finalUrl,
        path1: typeof body.path1 === 'string' ? body.path1 : null,
        path2: typeof body.path2 === 'string' ? body.path2 : null,
      },
    });

    return NextResponse.json({ assetGroup });
  } catch (err) {
    const { status, error, gadsError } = googleAdsErrorFromUnknown(err);
    return NextResponse.json({ error, ...(gadsError ? { gadsError } : {}) }, { status });
  }
}
