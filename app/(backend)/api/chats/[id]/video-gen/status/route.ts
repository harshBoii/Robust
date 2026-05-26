import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { serializeHeygenAsset, serializeHeygenJob } from '@/lib/heygen/job-response';
import { syncHeygenJob } from '@/lib/heygen/sync-job';
import { parseVideoGenState } from '@/lib/video-gen/state';
import { parseWorkflowState } from '@/lib/chats/serialize';
import { getChatSession } from '@/lib/chats/repository';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: chatSessionId } = await context.params;
  const chat = await getChatSession(chatSessionId, session.companyId);
  if (!chat) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const vg = parseVideoGenState(parseWorkflowState(chat.workflowState));
  const jobId = vg?.heygenJobId;
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'No video job for this chat' }, { status: 404 });
  }

  let job = await prisma.videoGenerationJob.findFirst({
    where: { id: jobId, companyId: session.companyId },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.heygenStatus !== 'COMPLETED' && job.heygenStatus !== 'FAILED') {
    try {
      job = await syncHeygenJob(job);
    } catch (e) {
      console.error('[chats/video-gen/status]', e);
    }
  }

  const asset =
    job.assetId != null
      ? await prisma.asset.findFirst({
          where: { id: job.assetId, companyId: session.companyId },
        })
      : null;

  return NextResponse.json({
    ok: true,
    job: serializeHeygenJob(job),
    asset: serializeHeygenAsset(asset),
    generatedAssetId: job.assetId,
  });
}
