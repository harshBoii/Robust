import 'server-only';

import { prisma } from '@/lib/prisma';
import { createAd } from '@/lib/meta/client';
import { requireMetaAdAccountId } from '@/lib/meta/integration-token';
import { resolveCreativeLandingUrl } from '@/lib/meta/resolve-creative-landing-url';
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
          select: { id: true, metaCampaignId: true, name: true, objective: true },
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

      const [company, primaryOffering] = await Promise.all([
        prisma.company.findUnique({
          where: { id: job.companyId },
          select: { website: true },
        }),
        prisma.offering.findFirst({
          where: { companyId: job.companyId, isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
          select: { url: true },
        }),
      ]);

      const headline =
        job.headlineOverride ?? adPreset?.headline ?? asset.title ?? 'Robust Ad';
      const landingUrl = resolveCreativeLandingUrl(
        [
          job.landingUrlOverride,
          adPreset?.landingPageUrl,
          primaryOffering?.url,
          company?.website,
        ],
        { fallback: 'https://example.com' },
      );
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
          adType: campaign.objective ?? undefined,
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

export type BulkPublishGroup = {
  bucketId: string | null;
  assetIds: string[];
  adSetId: string;
  headline: string;
  primaryText: string;
  description?: string | null;
  landingUrl: string;
  ctaType: string;
  pixelId?: string | null;
  assetCreatives?: Record<string, string>;
};

export async function enqueueBulkPublish(input: {
  companyId: string;
  campaignId: string;
  scheduledAt?: string;
  groups: BulkPublishGroup[];
}): Promise<string[]> {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduledAt && !Number.isFinite(scheduledAt.getTime())) {
    throw new Error('Invalid scheduledAt');
  }

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: input.companyId },
    select: { id: true },
  });
  if (!integration) throw new Error('Meta not connected');

  const campaign = await prisma.metaCampaign.findFirst({
    where: { id: input.campaignId, metaIntegrationId: integration.id },
    select: { id: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const schedule =
    scheduledAt != null
      ? await prisma.adSchedule.create({
          data: {
            companyId: input.companyId,
            scheduledAt,
            status: 'PENDING',
          },
          select: { id: true },
        })
      : null;

  const allJobData = input.groups.flatMap((g) =>
    g.assetIds.map((assetId) => ({
      companyId: input.companyId,
      metaIntegrationId: integration.id,
      campaignId: campaign.id,
      adSetId: g.adSetId,
      assetId,
      metaCreativeDbId: g.assetCreatives?.[assetId] ?? null,
      scheduleId: schedule?.id ?? null,
      scheduledAt,
      status: 'QUEUED' as const,
      headlineOverride: g.headline,
      primaryTextOverride: g.primaryText || g.headline,
      descriptionOverride: g.description ?? null,
      landingUrlOverride: g.landingUrl,
      ctaTypeOverride: g.ctaType,
      pixelIdOverride: g.pixelId ?? null,
      groupKey: g.bucketId,
    })),
  );

  const jobs = await prisma.$transaction(
    allJobData.map((data) => prisma.adPublishJob.create({ data, select: { id: true } })),
  );

  return jobs.map((j) => j.id);
}

export type DraftPublishJobInput = {
  campaignId: string;
  adSetId: string;
  assetId: string;
  /** When omitted, Meta creative is created at publish time (manual ADS path). */
  metaCreativeDbId?: string | null;
  headline: string;
  primaryText: string;
  description?: string | null;
  landingUrl: string;
  ctaType: string;
  pixelId?: string | null;
  groupKey?: string | null;
};

export async function enqueueDraftJobs(input: {
  companyId: string;
  jobs: DraftPublishJobInput[];
}): Promise<string[]> {
  if (!input.jobs.length) return [];

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: input.companyId },
    select: { id: true },
  });
  if (!integration) throw new Error('Meta not connected');

  const campaignIds = new Set(input.jobs.map((j) => j.campaignId));
  if (campaignIds.size !== 1) throw new Error('All draft jobs must share one campaign');

  const campaignId = input.jobs[0]!.campaignId;
  const campaign = await prisma.metaCampaign.findFirst({
    where: { id: campaignId, metaIntegrationId: integration.id },
    select: { id: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const jobs = await prisma.$transaction(
    input.jobs.map((j) =>
      prisma.adPublishJob.create({
        data: {
          companyId: input.companyId,
          metaIntegrationId: integration.id,
          campaignId: j.campaignId,
          adSetId: j.adSetId,
          assetId: j.assetId,
          metaCreativeDbId: j.metaCreativeDbId ?? null,
          status: 'DRAFT',
          headlineOverride: j.headline,
          primaryTextOverride: j.primaryText || j.headline,
          descriptionOverride: j.description ?? null,
          landingUrlOverride: j.landingUrl,
          ctaTypeOverride: j.ctaType,
          pixelIdOverride: j.pixelId ?? null,
          groupKey: j.groupKey ?? null,
        },
        select: { id: true },
      }),
    ),
  );

  return jobs.map((j) => j.id);
}

export async function promoteDraftJobToQueued(input: {
  companyId: string;
  jobId: string;
  scheduledAt?: string | null;
}): Promise<void> {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduledAt && !Number.isFinite(scheduledAt.getTime())) {
    throw new Error('Invalid scheduledAt');
  }

  const job = await prisma.adPublishJob.findFirst({
    where: { id: input.jobId, companyId: input.companyId, status: 'DRAFT' },
    select: { id: true },
  });
  if (!job) throw new Error('Draft job not found');

  const schedule =
    scheduledAt != null
      ? await prisma.adSchedule.create({
          data: {
            companyId: input.companyId,
            scheduledAt,
            status: 'PENDING',
          },
          select: { id: true },
        })
      : null;

  await prisma.adPublishJob.update({
    where: { id: job.id },
    data: {
      status: 'QUEUED',
      scheduledAt,
      scheduleId: schedule?.id ?? null,
    },
  });
}

export async function runPublishWorkerForCompany(companyId: string, limit = 10) {
  return processPublishJobs({ limit, companyId });
}
