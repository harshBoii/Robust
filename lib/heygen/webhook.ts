import 'server-only';

import { VideoGenJobStatus } from '@/app/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

import { getVideo } from './client';
import { deliverHeygenVideo } from './deliver-video';
import {
  extractHeygenCallbackId,
  extractHeygenDownloadUrl,
  extractHeygenStatus,
  extractHeygenThumbnailUrl,
  extractHeygenVideoId,
  isHeygenFailedStatus,
  isHeygenTerminalStatus,
} from './extractors';
import { mergeJobMetadata } from './job-metadata';
import { progressMessageForStatus } from './progress';

export class HeygenWebhookError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = 'HeygenWebhookError';
  }
}

export type HeygenWebhookPayload = {
  callbackId: string | null;
  videoId: string | null;
  status: string | null;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  raw: Record<string, unknown>;
};

export function parseHeygenWebhook(body: unknown): HeygenWebhookPayload {
  const wrapped =
    typeof body === 'object' && body !== null && 'payload' in body
      ? (body as { payload: unknown }).payload
      : body;

  if (typeof wrapped !== 'object' || wrapped === null) {
    throw new HeygenWebhookError('Invalid webhook body');
  }

  const raw = wrapped as Record<string, unknown>;

  return {
    callbackId: extractHeygenCallbackId(raw),
    videoId: extractHeygenVideoId(raw),
    status: extractHeygenStatus(raw),
    downloadUrl: extractHeygenDownloadUrl(raw),
    thumbnailUrl: extractHeygenThumbnailUrl(raw),
    raw,
  };
}

async function findJobForWebhook(payload: HeygenWebhookPayload) {
  if (payload.callbackId) {
    const byId = await prisma.videoGenerationJob.findUnique({
      where: { id: payload.callbackId },
    });
    if (byId) return byId;
  }

  if (payload.videoId) {
    return prisma.videoGenerationJob.findFirst({
      where: { heygenVideoId: payload.videoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  return null;
}

export async function handleHeygenWebhook(payload: HeygenWebhookPayload): Promise<void> {
  const job = await findJobForWebhook(payload);
  if (!job) {
    throw new HeygenWebhookError('Job not found', 404);
  }

  if (job.heygenStatus === VideoGenJobStatus.COMPLETED && job.assetId) {
    return;
  }

  const existingMeta = job.metadata;
  const webhookPayloads =
    (typeof existingMeta === 'object' &&
    existingMeta !== null &&
    !Array.isArray(existingMeta) &&
    Array.isArray((existingMeta as { heygen_webhook_payloads?: unknown }).heygen_webhook_payloads)
      ? ((existingMeta as { heygen_webhook_payloads: unknown[] }).heygen_webhook_payloads)
      : []) as unknown[];

  const metadata = mergeJobMetadata(existingMeta, {
    heygen_webhook_payloads: [...webhookPayloads, payload.raw],
  });

  let heygenVideoId = payload.videoId ?? job.heygenVideoId;
  let status = payload.status;
  let downloadUrl = payload.downloadUrl ?? job.downloadUrl;
  let thumbnailUrl = payload.thumbnailUrl ?? job.thumbnailUrl;

  if (!heygenVideoId) {
    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        heygenStatus: VideoGenJobStatus.PROCESSING,
        progressMessage: progressMessageForStatus(status, { hasVideoId: false }),
        metadata,
      },
    });
    return;
  }

  if (isHeygenTerminalStatus(status) && !downloadUrl) {
    const videoPayload = await getVideo(heygenVideoId);
    status = extractHeygenStatus(videoPayload) ?? status;
    downloadUrl = extractHeygenDownloadUrl(videoPayload) ?? downloadUrl;
    thumbnailUrl = extractHeygenThumbnailUrl(videoPayload) ?? thumbnailUrl;
  }

  if (isHeygenFailedStatus(status)) {
    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        heygenVideoId,
        heygenStatus: VideoGenJobStatus.FAILED,
        heygenError: status ?? 'HeyGen reported failure',
        progressMessage: progressMessageForStatus(status),
        metadata,
      },
    });
    return;
  }

  if (!isHeygenTerminalStatus(status)) {
    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        heygenVideoId,
        heygenStatus: VideoGenJobStatus.PROCESSING,
        progressMessage: progressMessageForStatus(status, { hasVideoId: true }),
        ...(downloadUrl ? { downloadUrl } : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        metadata,
      },
    });
    return;
  }

  if (!downloadUrl) {
    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        heygenVideoId,
        heygenStatus: VideoGenJobStatus.PROCESSING,
        progressMessage: 'Video ready but download URL not yet available.',
        metadata,
      },
    });
    return;
  }

  await prisma.videoGenerationJob.update({
    where: { id: job.id },
    data: {
      heygenVideoId,
      heygenStatus: VideoGenJobStatus.PROCESSING,
      progressMessage: 'Delivering video to your library…',
      downloadUrl,
      thumbnailUrl,
      metadata,
    },
  });

  await deliverHeygenVideo({
    job: {
      id: job.id,
      companyId: job.companyId,
      script: job.script,
      heygenVideoId,
    },
    downloadUrl,
    thumbnailUrl,
    playbackUrl: downloadUrl,
  });
}
