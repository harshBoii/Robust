import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { r2 } from '@/lib/cloudfare/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createAd, createAdCreative, uploadAdImage, uploadAdVideo } from '@/lib/meta/client';

export const dynamic = 'force-dynamic';

class WorkerAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function requireWorkerSecret(req: NextRequest) {
  const expected = process.env.WORKER_SECRET;
  if (!expected) {
    throw new Error('WORKER_SECRET is not set');
  }
  const got = req.headers.get('x-worker-secret') ?? '';
  if (got !== expected) {
    throw new WorkerAuthError('Unauthorized', 401);
  }
}

async function readAssetBytes(input: { r2Bucket: string; r2Key: string }): Promise<Uint8Array> {
  const res = await r2.send(new GetObjectCommand({ Bucket: input.r2Bucket, Key: input.r2Key }));
  if (!res.Body) throw new Error('Missing R2 body');
  return new Uint8Array(await res.Body.transformToByteArray());
}

function notificationForJob(input: { ok: boolean; title: string; message: string }) {
  return {
    type: input.ok ? 'AD_PUBLISH_SUCCESS' : 'AD_PUBLISH_FAILURE',
    title: input.title,
    message: input.message,
  };
}

export async function POST(req: NextRequest) {
  try {
    requireWorkerSecret(req);
  } catch (e) {
    const status = e instanceof WorkerAuthError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Worker auth failed' }, { status });
  }

  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '10') || 10));

  const processed: Array<{ id: string; status: string }> = [];

  // Process sequentially for now to simplify Meta rate-limits and error handling.
  for (let i = 0; i < limit; i++) {
    const job = await prisma.$transaction(async (tx) => {
      const row = await tx.adPublishJob.findFirst({
        where: {
          status: 'QUEUED',
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (!row) return null;

      return tx.adPublishJob.update({
        where: { id: row.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
        select: {
          id: true,
          attempts: true,
          maxAttempts: true,
          companyId: true,
          metaIntegrationId: true,
          campaignId: true,
          adSetId: true,
          assetId: true,
          adPresetId: true,
          duplicatedFromAdId: true,
        },
      });
    });

    if (!job) break;

    try {
      const [integration, campaign, adSet, asset, adPreset] = await Promise.all([
        prisma.metaIntegration.findUnique({
          where: { id: job.metaIntegrationId },
          select: { id: true, adAccountId: true, fbPageId: true },
        }),
        prisma.metaCampaign.findUnique({
          where: { id: job.campaignId },
          select: { id: true, metaCampaignId: true, name: true },
        }),
        prisma.metaAdSet.findUnique({
          where: { id: job.adSetId },
          select: { id: true, metaAdSetId: true, name: true },
        }),
        prisma.asset.findUnique({
          where: { id: job.assetId },
          select: {
            id: true,
            assetType: true,
            title: true,
            filename: true,
            r2Bucket: true,
            r2Key: true,
            thumbnailUrl: true,
            playbackUrl: true,
          },
        }),
        job.adPresetId
          ? prisma.adPreset.findUnique({
              where: { id: job.adPresetId },
              select: {
                id: true,
                name: true,
                headline: true,
                landingPageUrl: true,
                pixelIds: true,
              },
            })
          : Promise.resolve(null),
      ]);

      if (!integration) throw new Error('Meta integration missing');
      if (!campaign) throw new Error('Campaign missing');
      if (!adSet) throw new Error('Ad set missing');
      if (!asset) throw new Error('Asset missing');

      const headline = adPreset?.headline ?? asset.title ?? 'Robust Ad';
      const landingUrl = adPreset?.landingPageUrl ?? 'https://example.com';
      const primaryText = asset.title ?? '—';

      const bytes = await readAssetBytes({ r2Bucket: asset.r2Bucket, r2Key: asset.r2Key });

      let imageHash: string | null = null;
      let videoId: string | null = null;

      if (asset.assetType === 'IMAGE') {
        const up = await uploadAdImage({
          adAccountId: integration.adAccountId,
          bytes,
          filename: asset.filename,
        });
        imageHash = up.imageHash;
        await prisma.metaMedia.upsert({
          where: {
            metaIntegrationId_imageHash: {
              metaIntegrationId: integration.id,
              imageHash,
            },
          },
          create: {
            metaIntegrationId: integration.id,
            kind: 'image',
            imageHash,
            assetId: asset.id,
            imageUrl: asset.thumbnailUrl,
            r2Key: asset.r2Key,
            filename: asset.filename,
            mimeType: null,
            bytes: bytes.byteLength,
            status: 'ready',
          },
          update: {
            assetId: asset.id,
            imageUrl: asset.thumbnailUrl,
            r2Key: asset.r2Key,
            filename: asset.filename,
            bytes: bytes.byteLength,
            status: 'ready',
          },
        });
      } else if (asset.assetType === 'VIDEO') {
        const up = await uploadAdVideo({
          adAccountId: integration.adAccountId,
          bytes,
          filename: asset.filename,
          name: asset.title ?? asset.filename,
        });
        videoId = up.videoId;
        await prisma.metaMedia.upsert({
          where: {
            metaIntegrationId_videoId: {
              metaIntegrationId: integration.id,
              videoId,
            },
          },
          create: {
            metaIntegrationId: integration.id,
            kind: 'video',
            videoId,
            assetId: asset.id,
            videoUrl: asset.playbackUrl,
            thumbnailUrl: asset.thumbnailUrl,
            r2Key: asset.r2Key,
            filename: asset.filename,
            mimeType: null,
            bytes: bytes.byteLength,
            status: 'ready',
          },
          update: {
            assetId: asset.id,
            videoUrl: asset.playbackUrl,
            thumbnailUrl: asset.thumbnailUrl,
            r2Key: asset.r2Key,
            filename: asset.filename,
            bytes: bytes.byteLength,
            status: 'ready',
          },
        });
      } else {
        throw new Error(`Unsupported assetType: ${asset.assetType}`);
      }

      const creative = await createAdCreative({
        adAccountId: integration.adAccountId,
        fbPageId: integration.fbPageId,
        headline,
        primaryText,
        description: null,
        ctaType: 'LEARN_MORE',
        landingUrl,
        imageHash,
        videoId,
        pixelIds: adPreset?.pixelIds ?? [],
      });

      const creativeDb = await prisma.metaCreative.create({
        data: {
          metaIntegrationId: integration.id,
          metaCampaignId: campaign.id,
          metaCreativeId: creative.id,
          imageHash,
          videoId,
          headline,
          primaryText,
          description: null,
          ctaType: 'LEARN_MORE',
          landingUrl,
          thumbnailUrl: asset.thumbnailUrl,
          aiGenerated: false,
          compliancePassed: false,
          approvedByUser: true,
          approvedAt: new Date(),
        },
        select: { id: true },
      });

      const ad = await createAd({
        adAccountId: integration.adAccountId,
        adSetId: adSet.metaAdSetId,
        creativeId: creative.id,
        name: `${headline}`.slice(0, 200),
        status: 'ACTIVE',
      });

      const metaAdDb = await prisma.metaAd.create({
        data: {
          metaIntegrationId: integration.id,
          adSetId: adSet.id,
          metaCreativeDbId: creativeDb.id,
          metaAdId: ad.id,
          name: headline,
          status: 'ACTIVE',
          presetId: adPreset?.id ?? null,
          duplicatedFromId: job.duplicatedFromAdId ?? null,
          publishedAt: new Date(),
        },
        select: { id: true, metaAdId: true },
      });

      await prisma.adPublishJob.update({
        where: { id: job.id },
        data: {
          status: 'PUBLISHED',
          completedAt: new Date(),
          metaCreativeDbId: creativeDb.id,
          metaAdDbId: metaAdDb.id,
          lastError: null,
        },
      });

      await prisma.notification.create({
        data: {
          companyId: job.companyId,
          eventId: null,
          ...notificationForJob({
            ok: true,
            title: 'Ad published',
            message: `Published "${headline}" to Meta (${metaAdDb.metaAdId}).`,
          }),
        },
      });

      processed.push({ id: job.id, status: 'PUBLISHED' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Publish failed';

      const shouldRetry = job.attempts < job.maxAttempts;
      await prisma.adPublishJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? 'QUEUED' : 'FAILED',
          lastError: message,
          completedAt: shouldRetry ? null : new Date(),
        },
      });

      await prisma.notification.create({
        data: {
          companyId: job.companyId,
          eventId: null,
          ...notificationForJob({
            ok: false,
            title: shouldRetry ? 'Ad publish retrying' : 'Ad publish failed',
            message,
          }),
        },
      });

      processed.push({ id: job.id, status: shouldRetry ? 'QUEUED' : 'FAILED' });
    }
  }

  return NextResponse.json({ processed });
}

