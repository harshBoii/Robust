import { NextResponse } from 'next/server';

import type { Asset, CreativeFields } from '@/app/components/createAd/types';
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
  headline: string | null;
  campaignName: string | null;
  adSetName: string | null;
  assetId: string;
  creative: CreativeFields;
  asset: Asset;
};

function buildCreativeFields(input: {
  headlineOverride: string | null;
  primaryTextOverride: string | null;
  descriptionOverride: string | null;
  landingUrlOverride: string | null;
  ctaTypeOverride: string | null;
  pixelIdOverride: string | null;
  assetTitle: string;
}): CreativeFields {
  return {
    headline: input.headlineOverride?.trim() || input.assetTitle || 'Untitled ad',
    primaryText: input.primaryTextOverride?.trim() || input.assetTitle || '—',
    description: input.descriptionOverride?.trim() || '',
    landingUrl: input.landingUrlOverride?.trim() || '',
    ctaType: input.ctaTypeOverride?.trim() || 'LEARN_MORE',
    pixelId: input.pixelIdOverride?.trim() || '',
  };
}

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
      primaryTextOverride: true,
      descriptionOverride: true,
      landingUrlOverride: true,
      ctaTypeOverride: true,
      pixelIdOverride: true,
      campaign: { select: { name: true } },
      adSet: { select: { name: true } },
      asset: {
        select: {
          id: true,
          title: true,
          filename: true,
          assetType: true,
          bulkUploadId: true,
          assetBucketId: true,
          thumbnailUrl: true,
          playbackUrl: true,
        },
      },
    },
  });

  const rows: PendingRow[] = jobs.map((j) => ({
    id: j.id,
    status: j.status,
    createdAt: j.createdAt.toISOString(),
    headline: j.headlineOverride,
    campaignName: j.campaign?.name ?? null,
    adSetName: j.adSet?.name ?? null,
    assetId: j.assetId,
    creative: buildCreativeFields({
      headlineOverride: j.headlineOverride,
      primaryTextOverride: j.primaryTextOverride,
      descriptionOverride: j.descriptionOverride,
      landingUrlOverride: j.landingUrlOverride,
      ctaTypeOverride: j.ctaTypeOverride,
      pixelIdOverride: j.pixelIdOverride,
      assetTitle: j.asset.title,
    }),
    asset: {
      id: j.asset.id,
      title: j.asset.title,
      filename: j.asset.filename,
      thumbnailUrl: j.asset.thumbnailUrl,
      playbackUrl: j.asset.playbackUrl,
      assetType: j.asset.assetType,
      bulkUploadId: j.asset.bulkUploadId,
      assetBucketId: j.asset.assetBucketId,
    },
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
