import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { googleAdsErrorFromUnknown } from '@/lib/google-ads/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ creatives: [] });

  const creatives = await prisma.googleCreative.findMany({
    where: {
      googleAdsIntegrationId: integration.id,
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ creatives });
}

type PostBody = {
  campaignId?: unknown;
  adType?: unknown;
  headlines?: unknown;
  descriptions?: unknown;
  longHeadline?: unknown;
  businessName?: unknown;
  finalUrl?: unknown;
  path1?: unknown;
  path2?: unknown;
  assetId?: unknown;
};

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

  const adType = typeof body.adType === 'string' ? body.adType : 'RESPONSIVE_SEARCH';
  const headlines = Array.isArray(body.headlines)
    ? (body.headlines as unknown[]).filter((h): h is string => typeof h === 'string')
    : [];
  const descriptions = Array.isArray(body.descriptions)
    ? (body.descriptions as unknown[]).filter((d): d is string => typeof d === 'string')
    : [];

  if (!headlines.length) {
    return NextResponse.json({ error: 'At least one headline is required' }, { status: 400 });
  }

  try {
    const creative = await prisma.googleCreative.create({
      data: {
        googleAdsIntegrationId: integration.id,
        campaignId: typeof body.campaignId === 'string' ? body.campaignId : null,
        adType,
        headlines,
        descriptions,
        longHeadline: typeof body.longHeadline === 'string' ? body.longHeadline : null,
        businessName: typeof body.businessName === 'string' ? body.businessName : null,
        finalUrl: typeof body.finalUrl === 'string' ? body.finalUrl : null,
        path1: typeof body.path1 === 'string' ? body.path1 : null,
        path2: typeof body.path2 === 'string' ? body.path2 : null,
        assetId: typeof body.assetId === 'string' ? body.assetId : null,
      },
    });

    return NextResponse.json({ creative });
  } catch (err) {
    const { status, error } = googleAdsErrorFromUnknown(err);
    return NextResponse.json({ error }, { status });
  }
}
