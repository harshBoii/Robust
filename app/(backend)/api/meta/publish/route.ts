import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Body = {
  campaignId?: unknown;
  adSetId?: unknown;
  assetIds?: unknown;
  adPresetId?: unknown;
  scheduledAt?: unknown;
};

function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
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
  const adSetId = typeof body.adSetId === 'string' ? body.adSetId : '';
  const adPresetId = typeof body.adPresetId === 'string' ? body.adPresetId : null;
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((x) => typeof x === 'string') as string[] : [];
  const scheduledAt = parseIsoDate(body.scheduledAt);

  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
  if (!adSetId) return NextResponse.json({ error: 'Missing adSetId' }, { status: 400 });
  if (assetIds.length === 0) return NextResponse.json({ error: 'Missing assetIds' }, { status: 400 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });

  const [campaign, adSet] = await Promise.all([
    prisma.metaCampaign.findFirst({
      where: { id: campaignId, metaIntegrationId: integration.id },
      select: { id: true },
    }),
    prisma.metaAdSet.findFirst({
      where: { id: adSetId, metaIntegrationId: integration.id },
      select: { id: true },
    }),
  ]);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!adSet) return NextResponse.json({ error: 'Ad set not found' }, { status: 404 });

  if (adPresetId) {
    const presetOk = await prisma.adPreset.findFirst({
      where: { id: adPresetId, companyId: session.companyId },
      select: { id: true },
    });
    if (!presetOk) return NextResponse.json({ error: 'Ad preset not found' }, { status: 404 });
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, companyId: session.companyId },
    select: { id: true },
  });
  const foundIds = new Set(assets.map((a) => a.id));
  const missing = assetIds.filter((id) => !foundIds.has(id));
  if (missing.length) return NextResponse.json({ error: `Assets not found: ${missing.join(',')}` }, { status: 404 });

  const schedule =
    scheduledAt
      ? await prisma.adSchedule.create({
          data: {
            companyId: session.companyId,
            scheduledAt,
            status: 'PENDING',
          },
          select: { id: true },
        })
      : null;

  const jobs = await prisma.$transaction(
    assetIds.map((assetId) =>
      prisma.adPublishJob.create({
        data: {
          companyId: session.companyId,
          metaIntegrationId: integration.id,
          campaignId: campaign.id,
          adSetId: adSet.id,
          assetId,
          adPresetId,
          scheduleId: schedule?.id ?? null,
          scheduledAt,
          status: 'QUEUED',
        },
        select: { id: true },
      }),
    ),
  );

  return NextResponse.json({
    scheduleId: schedule?.id ?? null,
    jobIds: jobs.map((j) => j.id),
  });
}

