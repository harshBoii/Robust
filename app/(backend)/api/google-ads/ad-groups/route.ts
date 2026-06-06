import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { googleAdsErrorFromUnknown } from '@/lib/google-ads/errors';
import { syncGoogleAdGroups, createAndStoreGoogleAdGroupFromPreset } from '@/lib/google-ads/sync';

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
  if (!integration) return NextResponse.json({ adGroups: [] });

  const campaign = await prisma.googleCampaign.findFirst({
    where: { id: campaignId, googleAdsIntegrationId: integration.id },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const adGroups = await syncGoogleAdGroups({
    googleAdsIntegrationId: integration.id,
    campaignDbId: campaign.id,
  });
  return NextResponse.json({ adGroups });
}

type PostBody = { presetId?: unknown; campaignId?: unknown; name?: unknown };

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const presetId = typeof body.presetId === 'string' ? body.presetId : '';
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  const name = typeof body.name === 'string' ? body.name : undefined;
  if (!presetId) return NextResponse.json({ error: 'Missing presetId' }, { status: 400 });
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });

  const campaign = await prisma.googleCampaign.findFirst({
    where: { id: campaignId, googleAdsIntegrationId: integration.id },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const preset = await prisma.googleAdGroupPreset.findFirst({
    where: { id: presetId },
    select: { id: true },
  });
  if (!preset) return NextResponse.json({ error: 'Preset not found' }, { status: 404 });

  try {
    const adGroup = await createAndStoreGoogleAdGroupFromPreset({
      googleAdsIntegrationId: integration.id,
      campaignDbId: campaign.id,
      presetId,
      name,
    });
    return NextResponse.json({ adGroup });
  } catch (err) {
    const { status, error, gadsError } = googleAdsErrorFromUnknown(err);
    return NextResponse.json({ error, ...(gadsError ? { gadsError } : {}) }, { status });
  }
}
