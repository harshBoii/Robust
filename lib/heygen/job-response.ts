import type { Asset, VideoGenerationJob } from '@/app/generated/prisma/client';

import { getHeygenSessionId } from './job-metadata';

export function serializeHeygenJob(job: VideoGenerationJob) {
  return {
    id: job.id,
    heygenStatus: job.heygenStatus,
    progressMessage: job.progressMessage,
    heygenVideoId: job.heygenVideoId,
    assetId: job.assetId,
    downloadUrl: job.downloadUrl,
    playbackUrl: job.playbackUrl,
    thumbnailUrl: job.thumbnailUrl,
    heygenError: job.heygenError,
    sessionId: getHeygenSessionId(job.metadata),
  };
}

export function serializeHeygenAsset(asset: Asset | null) {
  if (!asset) return null;
  return {
    id: asset.id,
    status: asset.status,
    playbackUrl: asset.playbackUrl,
    thumbnailUrl: asset.thumbnailUrl,
    streamId: asset.streamId,
    title: asset.title,
  };
}
