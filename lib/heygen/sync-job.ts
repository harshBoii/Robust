import 'server-only';

import type { VideoGenerationJob } from '@/app/generated/prisma/client';
import { VideoGenJobStatus } from '@/app/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

import { getVideo, getVideoAgentSession } from './client';
import {
  extractHeygenDownloadUrl,
  extractHeygenStatus,
  extractHeygenThumbnailUrl,
  extractHeygenVideoId,
  isHeygenFailedStatus,
  isHeygenTerminalStatus,
} from './extractors';
import { deliverHeygenVideo } from './deliver-video';
import { getHeygenSessionId, mergeJobMetadata } from './job-metadata';
import { progressMessageForStatus } from './progress';

function mapHeygenStatusToJob(
  heygenStatus: string | null,
): VideoGenJobStatus | null {
  if (!heygenStatus) return null;
  if (isHeygenFailedStatus(heygenStatus)) return VideoGenJobStatus.FAILED;
  if (isHeygenTerminalStatus(heygenStatus)) return VideoGenJobStatus.COMPLETED;
  return VideoGenJobStatus.PROCESSING;
}

export async function syncHeygenJob(
  job: VideoGenerationJob,
): Promise<VideoGenerationJob> {
  if (job.heygenStatus === VideoGenJobStatus.COMPLETED && job.assetId) {
    return job;
  }
  if (job.heygenStatus === VideoGenJobStatus.FAILED) {
    return job;
  }

  const sessionId = getHeygenSessionId(job.metadata);
  let heygenVideoId = job.heygenVideoId;
  let latestPayload: unknown = null;
  let heygenStatusRaw: string | null = null;
  let downloadUrl: string | null = job.downloadUrl;
  let thumbnailUrl: string | null = job.thumbnailUrl;
  let playbackUrl: string | null = job.playbackUrl;

  if (sessionId && !heygenVideoId) {
    const sessionPayload = await getVideoAgentSession(sessionId);
    latestPayload = sessionPayload;
    heygenVideoId = extractHeygenVideoId(sessionPayload);
    heygenStatusRaw = extractHeygenStatus(sessionPayload);
  }

  if (heygenVideoId) {
    const videoPayload = await getVideo(heygenVideoId);
    latestPayload = videoPayload;
    heygenStatusRaw = extractHeygenStatus(videoPayload) ?? heygenStatusRaw;
    downloadUrl = extractHeygenDownloadUrl(videoPayload) ?? downloadUrl;
    thumbnailUrl = extractHeygenThumbnailUrl(videoPayload) ?? thumbnailUrl;
    playbackUrl = downloadUrl ?? playbackUrl;
  }

  const mappedStatus = mapHeygenStatusToJob(heygenStatusRaw);
  const progressMessage = progressMessageForStatus(heygenStatusRaw, {
    hasVideoId: Boolean(heygenVideoId),
  });

  const metadataPatch = mergeJobMetadata(job.metadata, {
    ...(sessionId && latestPayload && !heygenVideoId
      ? { heygen_session_response: latestPayload }
      : {}),
    ...(heygenVideoId && latestPayload ? { heygen_video_response: latestPayload } : {}),
  });

  const updated = await prisma.videoGenerationJob.update({
    where: { id: job.id },
    data: {
      ...(heygenVideoId ? { heygenVideoId } : {}),
      ...(mappedStatus ? { heygenStatus: mappedStatus } : {}),
      progressMessage,
      ...(downloadUrl ? { downloadUrl } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(playbackUrl ? { playbackUrl } : {}),
      metadata: metadataPatch,
      ...(mappedStatus === VideoGenJobStatus.FAILED
        ? { heygenError: heygenStatusRaw ?? 'HeyGen reported failure' }
        : {}),
    },
  });

  if (
    mappedStatus === VideoGenJobStatus.COMPLETED &&
    !updated.assetId &&
    downloadUrl &&
    heygenVideoId
  ) {
    await deliverHeygenVideo({
      job: {
        id: updated.id,
        companyId: updated.companyId,
        script: updated.script,
        heygenVideoId,
      },
      downloadUrl,
      thumbnailUrl,
      playbackUrl,
    });
    return prisma.videoGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
  }

  return updated;
}
