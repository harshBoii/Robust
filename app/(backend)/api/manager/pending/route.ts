import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  promoteDraftJobToQueued,
  runPublishWorkerForCompany,
} from '@/lib/meta/process-publish-jobs';

export const dynamic = 'force-dynamic';

export type PendingRow = {
  id: string;
  status: string;
  createdAt: string;
  thumbnailUrl: string | null;
  headline: string | null;
  campaignName: string | null;
  adSetName: string | null;
  assetId: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ rows: [] satisfies PendingRow[] });

  const jobs = await prisma.adPublishJob.findMany({
    where: {
      companyId: session.companyId,
      metaIntegrationId: integration.id,
      status: 'DRAFT',
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      status: true,
      createdAt: true,
      assetId: true,
      headlineOverride: true,
      metaCreativeDbId: true,
      campaign: { select: { name: true } },
      adSet: { select: { name: true } },
    },
  });

  const assetIds = jobs.map((j) => j.assetId);
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, thumbnailUrl: true },
      })
    : [];
  const thumbByAsset = new Map(assets.map((a) => [a.id, a.thumbnailUrl]));

  const creativeIds = jobs
    .map((j) => j.metaCreativeDbId)
    .filter((id): id is string => Boolean(id));
  const creatives = creativeIds.length
    ? await prisma.metaCreative.findMany({
        where: { id: { in: creativeIds } },
        select: { id: true, thumbnailUrl: true },
      })
    : [];
  const thumbByCreative = new Map(creatives.map((c) => [c.id, c.thumbnailUrl]));

  const rows: PendingRow[] = jobs.map((j) => ({
    id: j.id,
    status: j.status,
    createdAt: j.createdAt.toISOString(),
    thumbnailUrl:
      (j.metaCreativeDbId ? thumbByCreative.get(j.metaCreativeDbId) : null) ??
      thumbByAsset.get(j.assetId) ??
      null,
    headline: j.headlineOverride,
    campaignName: j.campaign?.name ?? null,
    adSetName: j.adSet?.name ?? null,
    assetId: j.assetId,
  }));

  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { jobId?: string; action?: string; scheduledAt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  if (action === 'publish') {
    await promoteDraftJobToQueued({ companyId: session.companyId, jobId });
    await runPublishWorkerForCompany(session.companyId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'schedule') {
    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : '';
    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
    }
    await promoteDraftJobToQueued({
      companyId: session.companyId,
      jobId,
      scheduledAt,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
