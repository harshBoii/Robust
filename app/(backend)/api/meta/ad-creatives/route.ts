import { NextRequest, NextResponse } from 'next/server';

import { apiErrorFromUnknown } from '@/lib/meta/errors';
import { storeAdCreativeForAsset } from '@/lib/meta/store-ad-creative';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ creatives: [] });

  const creatives = await prisma.metaCreative.findMany({
    where: {
      metaIntegrationId: integration.id,
      metaCreativeId: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      metaCreativeId: true,
      assetId: true,
      headline: true,
      primaryText: true,
      description: true,
      ctaType: true,
      landingUrl: true,
      thumbnailUrl: true,
      createdAt: true,
      asset: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          assetType: true,
        },
      },
    },
  });

  return NextResponse.json({ creatives });
}

type PostBody = {
  assetId?: unknown;
  headline?: unknown;
  primaryText?: unknown;
  description?: unknown;
  landingUrl?: unknown;
  ctaType?: unknown;
  pixelId?: unknown;
  campaignId?: unknown;
  adType?: unknown;
  tone?: unknown;
  groupLabel?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : '';
  const headline = typeof body.headline === 'string' ? body.headline.trim() : '';
  const primaryText = typeof body.primaryText === 'string' ? body.primaryText.trim() : '';
  const landingUrl = typeof body.landingUrl === 'string' ? body.landingUrl.trim() : '';
  const ctaType = typeof body.ctaType === 'string' ? body.ctaType.trim() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim() || null : null;
  const pixelId = typeof body.pixelId === 'string' ? body.pixelId.trim() || null : null;
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() || null : null;
  const adType = typeof body.adType === 'string' ? body.adType.trim() || null : null;
  const tone = typeof body.tone === 'string' ? body.tone.trim() || null : null;
  const groupLabel = typeof body.groupLabel === 'string' ? body.groupLabel.trim() || null : null;

  if (!assetId) return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });

  try {
    const creative = await storeAdCreativeForAsset({
      companyId: session.companyId,
      assetId,
      headline,
      primaryText,
      description,
      landingUrl,
      ctaType: ctaType || 'LEARN_MORE',
      pixelId,
      metaCampaignId: campaignId,
      adType,
      tone,
      groupLabel,
    });

    return NextResponse.json({ creative });
  } catch (err) {
    const { status, error, metaError } = apiErrorFromUnknown(err);
    return NextResponse.json({ error, ...(metaError ? { metaError } : {}) }, { status });
  }
}
