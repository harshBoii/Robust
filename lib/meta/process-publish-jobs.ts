import 'server-only';

import { prisma } from '@/lib/prisma';
import { createAd } from '@/lib/meta/client';
import { requireMetaAdAccountId } from '@/lib/meta/integration-token';
import { storeAdCreativeForAsset } from '@/lib/meta/store-ad-creative';

export type ProcessedPublishJob = {
  id: string;
  status: string;
  error?: string;
};

function notificationForJob(input: { ok: boolean; title: string; message: string }) {
  return {
    type: input.ok ? 'AD_PUBLISH_SUCCESS' : 'AD_PUBLISH_FAILURE',
    title: input.title,
    message: input.message,
  };
}

export async function processPublishJobs(input: {
  limit: number;
  companyId?: string;
}): Promise<{ processed: ProcessedPublishJob[] }> {
  const limit = Math.min(20, Math.max(1, input.limit));
  const processed: ProcessedPublishJob[] = [];

  for (let i = 0; i < limit; i++) {
    const job = await prisma.$transaction(async (tx) => {
      const row = await tx.adPublishJob.findFirst({
        where: {
          status: 'QUEUED',
          ...(input.companyId ? { companyId: input.companyId } : {}),
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
          headlineOverride: true,
          primaryTextOverride: true,
          descriptionOverride: true,
          landingUrlOverride: true,
          ctaTypeOverride: true,
          pixelIdOverride: true,
          metaCreativeDbId: true,
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
      const adAccountId = requireMetaAdAccountId(integration.adAccountId);
      if (!campaign) throw new Error('Campaign missing');
      if (!adSet) throw new Error('Ad set missing');
      if (!asset) throw new Error('Asset missing');

      const headline =
        job.headlineOverride ?? adPreset?.headline ?? asset.title ?? 'Robust Ad';
      const landingUrl =
        job.landingUrlOverride ?? adPreset?.landingPageUrl ?? 'https://example.com';
      const primaryText = job.primaryTextOverride ?? asset.title ?? '—';
      const description = job.descriptionOverride ?? null;
      const ctaType = job.ctaTypeOverride ?? 'LEARN_MORE';
      const pixelIds = job.pixelIdOverride
        ? [job.pixelIdOverride]
        : (adPreset?.pixelIds ?? []);

      let creativeDbId: string;
      let metaCreativeId: string;

      if (job.metaCreativeDbId) {
        const existing = await prisma.metaCreative.findFirst({
          where: {
            id: job.metaCreativeDbId,
            metaIntegrationId: integration.id,
          },
          select: { id: true, metaCreativeId: true },
        });
        if (!existing?.metaCreativeId) {
          throw new Error('Pre-created ad creative not found or missing Meta id');
        }
        creativeDbId = existing.id;
        metaCreativeId = existing.metaCreativeId;
      } else {
        const stored = await storeAdCreativeForAsset({
          companyId: job.companyId,
          assetId: asset.id,
          headline,
          primaryText,
          description,
          landingUrl,
          ctaType,
          pixelId: pixelIds[0] ?? null,
          metaCampaignId: campaign.id,
        });
        creativeDbId = stored.id;
        metaCreativeId = stored.metaCreativeId;
      }

      const ad = await createAd({
        companyId: job.companyId,
        adAccountId,
        adSetId: adSet.metaAdSetId,
        creativeId: metaCreativeId,
        name: `${headline}`.slice(0, 200),
        status: 'ACTIVE',
      });

      const metaAdDb = await prisma.metaAd.create({
        data: {
          metaIntegrationId: integration.id,
          adSetId: adSet.id,
          metaCreativeDbId: creativeDbId,
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
          metaCreativeDbId: creativeDbId,
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

      const status = shouldRetry ? 'QUEUED' : 'FAILED';
      processed.push({ id: job.id, status, error: message });
    }
  }

  return { processed };
}
