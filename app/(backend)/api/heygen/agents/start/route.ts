import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAppOrigin } from '@/lib/app-origin';
import { getSession } from '@/lib/auth/session';
import { HeygenApiError } from '@/lib/heygen/api';
import { startVideoAgent } from '@/lib/heygen/client';
import { extractHeygenSessionId } from '@/lib/heygen/extractors';
import { mergeJobMetadata } from '@/lib/heygen/job-metadata';
import { progressMessageForStatus } from '@/lib/heygen/progress';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const startSchema = z.object({
  prompt: z.string().trim().min(1, 'prompt is required'),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const job = await prisma.videoGenerationJob.create({
    data: {
      companyId: session.companyId,
      script: parsed.data.prompt,
      avatarId: 'auto',
      voiceId: 'auto',
      heygenStatus: 'PENDING',
      metadata: { mode: 'video_agent_simple' },
    },
  });

  const callbackUrl = `${getAppOrigin()}/api/heygen/webhook`;

  try {
    const heygenResponse = await startVideoAgent({
      prompt: parsed.data.prompt,
      callbackUrl,
      callbackId: job.id,
    });

    const sessionId = extractHeygenSessionId(heygenResponse);
    if (!sessionId) {
      throw new HeygenApiError('HeyGen did not return a session_id', 502, heygenResponse);
    }

    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        heygenStatus: 'PROCESSING',
        progressMessage: progressMessageForStatus('processing', { hasVideoId: false }),
        metadata: mergeJobMetadata(job.metadata, {
          mode: 'video_agent_simple',
          heygen_session_id: sessionId,
          heygen_start_response: heygenResponse,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      sessionId,
    });
  } catch (e) {
    const message =
      e instanceof HeygenApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'HeyGen request failed';

    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        heygenStatus: 'FAILED',
        heygenError: message,
        progressMessage: progressMessageForStatus('failed'),
      },
    });

    console.error('[heygen/agents/start]', e);
    return NextResponse.json({ ok: false, error: message, jobId: job.id }, { status: 502 });
  }
}
