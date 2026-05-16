import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type GroupInput = {
  bucketId?: unknown;
  assetIds?: unknown;
  adSetId?: unknown;
  headline?: unknown;
  primaryText?: unknown;
  description?: unknown;
  landingUrl?: unknown;
  ctaType?: unknown;
  pixelId?: unknown;
  /** assetId → metaCreative DB id (pre-created on Meta) */
  assetCreatives?: unknown;
};

type Body = {
  campaignId?: unknown;
  scheduledAt?: unknown;
  groups?: unknown;
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
  const scheduledAt = parseIsoDate(body.scheduledAt);

  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
  if (!Array.isArray(body.groups) || body.groups.length === 0) {
    return NextResponse.json({ error: 'Missing or empty groups' }, { status: 400 });
  }

  const rawGroups = body.groups as GroupInput[];

  // Parse and validate each group
  const groups: {
    bucketId: string | null;
    assetIds: string[];
    adSetId: string;
    headline: string;
    primaryText: string;
    description: string | null;
    landingUrl: string;
    ctaType: string;
    pixelId: string | null;
    assetCreatives: Record<string, string>;
  }[] = [];

  for (let i = 0; i < rawGroups.length; i++) {
    const g = rawGroups[i];
    const adSetId = typeof g.adSetId === 'string' ? g.adSetId : '';
    const headline = typeof g.headline === 'string' ? g.headline.trim() : '';
    const primaryText = typeof g.primaryText === 'string' ? g.primaryText.trim() : '';
    const landingUrl = typeof g.landingUrl === 'string' ? g.landingUrl.trim() : '';
    const ctaType = typeof g.ctaType === 'string' ? g.ctaType.trim() : 'LEARN_MORE';
    const assetIds = Array.isArray(g.assetIds)
      ? g.assetIds.filter((x): x is string => typeof x === 'string')
      : [];

    if (!adSetId) return NextResponse.json({ error: `Group ${i}: missing adSetId` }, { status: 400 });
    if (!headline) return NextResponse.json({ error: `Group ${i}: missing headline` }, { status: 400 });
    if (!landingUrl) return NextResponse.json({ error: `Group ${i}: missing landingUrl` }, { status: 400 });
    if (assetIds.length === 0) return NextResponse.json({ error: `Group ${i}: missing assetIds` }, { status: 400 });

    const assetCreatives: Record<string, string> = {};
    if (g.assetCreatives && typeof g.assetCreatives === 'object' && !Array.isArray(g.assetCreatives)) {
      for (const [assetId, creativeDbId] of Object.entries(g.assetCreatives)) {
        if (typeof creativeDbId === 'string' && creativeDbId.trim()) {
          assetCreatives[assetId] = creativeDbId.trim();
        }
      }
    }

    groups.push({
      bucketId: typeof g.bucketId === 'string' ? g.bucketId : null,
      assetIds,
      adSetId,
      headline,
      primaryText: primaryText || headline,
      description: typeof g.description === 'string' ? g.description.trim() || null : null,
      landingUrl,
      ctaType,
      pixelId: typeof g.pixelId === 'string' && g.pixelId.trim() ? g.pixelId.trim() : null,
      assetCreatives,
    });
  }

  // Validate integration
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });

  // Validate campaign
  const campaign = await prisma.metaCampaign.findFirst({
    where: { id: campaignId, metaIntegrationId: integration.id },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Validate all adSets (deduplicated)
  const uniqueAdSetIds = [...new Set(groups.map((g) => g.adSetId))];
  const adSetsFound = await prisma.metaAdSet.findMany({
    where: { id: { in: uniqueAdSetIds }, metaIntegrationId: integration.id },
    select: { id: true },
  });
  const foundAdSetIds = new Set(adSetsFound.map((a) => a.id));
  for (const id of uniqueAdSetIds) {
    if (!foundAdSetIds.has(id)) {
      return NextResponse.json({ error: `Ad set not found: ${id}` }, { status: 404 });
    }
  }

  // Validate all assets
  const allAssetIds = [...new Set(groups.flatMap((g) => g.assetIds))];
  const assetsFound = await prisma.asset.findMany({
    where: { id: { in: allAssetIds }, companyId: session.companyId },
    select: { id: true },
  });
  const foundAssetIds = new Set(assetsFound.map((a) => a.id));
  for (const id of allAssetIds) {
    if (!foundAssetIds.has(id)) {
      return NextResponse.json({ error: `Asset not found: ${id}` }, { status: 404 });
    }
  }

  // Create schedule if needed
  const schedule = scheduledAt
    ? await prisma.adSchedule.create({
        data: { companyId: session.companyId, scheduledAt, status: 'PENDING' },
        select: { id: true },
      })
    : null;

  // Create all jobs in a single transaction
  const creativeDbIds = [
    ...new Set(groups.flatMap((g) => Object.values(g.assetCreatives))),
  ];
  if (creativeDbIds.length > 0) {
    const found = await prisma.metaCreative.findMany({
      where: {
        id: { in: creativeDbIds },
        metaIntegrationId: integration.id,
        metaCreativeId: { not: null },
      },
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    for (const id of creativeDbIds) {
      if (!foundIds.has(id)) {
        return NextResponse.json({ error: `Ad creative not found: ${id}` }, { status: 404 });
      }
    }
  }

  const allJobData = groups.flatMap((g) =>
    g.assetIds.map((assetId) => ({
      companyId: session.companyId,
      metaIntegrationId: integration.id,
      campaignId: campaign.id,
      adSetId: g.adSetId,
      assetId,
      metaCreativeDbId: g.assetCreatives[assetId] ?? null,
      scheduleId: schedule?.id ?? null,
      scheduledAt,
      status: 'QUEUED' as const,
      headlineOverride: g.headline,
      primaryTextOverride: g.primaryText,
      descriptionOverride: g.description,
      landingUrlOverride: g.landingUrl,
      ctaTypeOverride: g.ctaType,
      pixelIdOverride: g.pixelId,
      groupKey: g.bucketId,
    })),
  );

  const jobs = await prisma.$transaction(
    allJobData.map((data) => prisma.adPublishJob.create({ data, select: { id: true } })),
  );

  return NextResponse.json({
    scheduleId: schedule?.id ?? null,
    jobIds: jobs.map((j) => j.id),
  });
}
