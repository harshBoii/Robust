import 'server-only';

import { getAppOrigin } from '@/lib/app-origin';
import { startVideoAgent } from '@/lib/heygen/client';
import { extractHeygenSessionId } from '@/lib/heygen/extractors';
import { HeygenApiError } from '@/lib/heygen/api';
import { mergeJobMetadata } from '@/lib/heygen/job-metadata';
import { prisma } from '@/lib/prisma';

import type { VideoGenSubpath } from '@/lib/video-gen/types';

export type StartHeygenFromChatInput = {
  companyId: string;
  chatSessionId: string;
  subpath: VideoGenSubpath;
  adScript: string;
  directorPrompt: string;
  adCategory?: string;
  durationBucket?: string;
};

export type StartHeygenFromChatResult = {
  jobId: string;
  sessionId: string;
};

export async function startHeygenFromChat(
  input: StartHeygenFromChatInput,
): Promise<StartHeygenFromChatResult> {
  const job = await prisma.videoGenerationJob.create({
    data: {
      companyId: input.companyId,
      script: input.adScript,
      avatarId: 'auto',
      voiceId: 'auto',
      heygenStatus: 'PENDING',
      metadata: {
        mode: 'video_agent_chat',
        chatSessionId: input.chatSessionId,
        subpath: input.subpath,
        adCategory: input.adCategory ?? null,
        durationBucket: input.durationBucket ?? null,
        director_prompt: input.directorPrompt,
      },
    },
  });

  const callbackUrl = `${getAppOrigin()}/api/heygen/webhook`;

  try {
    const heygenResponse = await startVideoAgent({
      prompt: input.directorPrompt,
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
        progressMessage: 'Video generation started.',
        metadata: mergeJobMetadata(job.metadata, {
          mode: 'video_agent_chat',
          chatSessionId: input.chatSessionId,
          subpath: input.subpath,
          director_prompt: input.directorPrompt,
          heygen_session_id: sessionId,
          heygen_start_response: heygenResponse,
        }),
      },
    });

    return { jobId: job.id, sessionId };
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
      },
    });
    throw e;
  }
}
