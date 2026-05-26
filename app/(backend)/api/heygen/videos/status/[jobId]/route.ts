import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { serializeHeygenAsset, serializeHeygenJob } from '@/lib/heygen/job-response';
import { syncHeygenJob } from '@/lib/heygen/sync-job';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await context.params;

  const job = await prisma.videoGenerationJob.findFirst({
    where: { id: jobId, companyId: session.companyId },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  let synced = job;
  if (job.heygenStatus !== 'COMPLETED' && job.heygenStatus !== 'FAILED') {
    try {
      synced = await syncHeygenJob(job);
    } catch (e) {
      console.error('[heygen/videos/status]', e);
    }
  }

  const asset =
    synced.assetId != null
      ? await prisma.asset.findFirst({
          where: { id: synced.assetId, companyId: session.companyId },
        })
      : null;

  return NextResponse.json({
    ok: true,
    job: serializeHeygenJob(synced),
    asset: serializeHeygenAsset(asset),
  });
}
