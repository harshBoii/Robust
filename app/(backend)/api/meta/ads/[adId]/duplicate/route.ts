import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Body = { assetId?: unknown };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ adId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { adId } = await ctx.params;
  if (!adId) return NextResponse.json({ error: 'Missing adId' }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const assetId = typeof body.assetId === 'string' ? body.assetId : '';
  if (!assetId) return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });

  const source = await prisma.metaAd.findFirst({
    where: { metaAdId: adId, metaIntegrationId: integration.id },
    select: {
      id: true,
      adSetId: true,
      presetId: true,
    },
  });
  if (!source) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });

  const adSet = await prisma.metaAdSet.findFirst({
    where: { id: source.adSetId, metaIntegrationId: integration.id },
    select: { id: true, campaignId: true },
  });
  if (!adSet) return NextResponse.json({ error: 'Ad set not found' }, { status: 404 });

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId: session.companyId },
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  const job = await prisma.adPublishJob.create({
    data: {
      companyId: session.companyId,
      metaIntegrationId: integration.id,
      campaignId: adSet.campaignId,
      adSetId: adSet.id,
      assetId: asset.id,
      adPresetId: source.presetId ?? null,
      duplicatedFromAdId: source.id,
      status: 'QUEUED',
    },
    select: { id: true },
  });

  return NextResponse.json({ jobId: job.id });
}

