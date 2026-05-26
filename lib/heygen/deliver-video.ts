import 'server-only';

import { PutObjectCommand } from '@aws-sdk/client-s3';

import type { VideoGenerationJob } from '@/app/generated/prisma/client';
import { UploadSource } from '@/app/generated/prisma/enums';
import { enqueueAssetStreamUpload } from '@/lib/cloudfare/stream';
import { getR2PublicObjectUrl, r2 } from '@/lib/cloudfare/r2';
import { prisma } from '@/lib/prisma';

export type DeliverHeygenVideoInput = {
  job: Pick<VideoGenerationJob, 'id' | 'companyId' | 'script' | 'heygenVideoId'>;
  downloadUrl: string;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
};

export type DeliverHeygenVideoResult = {
  assetId: string;
  r2Key: string;
};

export async function deliverHeygenVideo(
  input: DeliverHeygenVideoInput,
): Promise<DeliverHeygenVideoResult> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME is not configured');

  const res = await fetch(input.downloadUrl);
  if (!res.ok) {
    throw new Error(`Failed to download HeyGen video (${res.status})`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const r2Key = `generated/${input.job.companyId}/heygen/${input.job.id}.mp4`;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: bytes,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const publicUrl = getR2PublicObjectUrl(r2Key);
  const title =
    input.job.script.length > 120
      ? `${input.job.script.slice(0, 117)}…`
      : input.job.script;

  const asset = await prisma.asset.create({
    data: {
      companyId: input.job.companyId,
      assetType: 'VIDEO',
      title: title || 'HeyGen video',
      filename: r2Key.split('/').pop() ?? 'heygen.mp4',
      originalSize: BigInt(bytes.length),
      status: 'PROCESSING',
      r2Key,
      r2Bucket: bucket,
      mimeType: 'video/mp4',
      thumbnailUrl: input.thumbnailUrl ?? publicUrl ?? null,
      uploadSource: UploadSource.GENERATED,
      metadata: {
        heygenJobId: input.job.id,
        heygenVideoId: input.job.heygenVideoId ?? null,
        mode: 'video_agent_simple',
      },
    },
  });

  await enqueueAssetStreamUpload(asset.id, 'HIGH');

  await prisma.videoGenerationJob.update({
    where: { id: input.job.id },
    data: {
      assetId: asset.id,
      downloadUrl: input.downloadUrl,
      playbackUrl: input.playbackUrl ?? null,
      thumbnailUrl: input.thumbnailUrl ?? asset.thumbnailUrl,
      heygenStatus: 'COMPLETED',
      progressMessage: 'Video delivered to your library.',
    },
  });

  return { assetId: asset.id, r2Key };
}
