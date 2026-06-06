import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  createResponsiveSearchAd,
  createResponsiveDisplayAd,
  createGoogleAssetGroup,
} from '@/lib/google-ads/client';
import { uploadGalleryAssetToGoogle } from '@/lib/google-ads/store-creative';
import { googleAdsErrorFromRaw } from '@/lib/google-ads/errors';

export type ProcessedGooglePublishJob = {
  id: string;
  status: string;
  error?: string;
};

export async function processGooglePublishJobs(input: {
  limit: number;
  companyId?: string;
}): Promise<{ processed: ProcessedGooglePublishJob[] }> {
  const limit = Math.min(20, Math.max(1, input.limit));
  const processed: ProcessedGooglePublishJob[] = [];

  for (let i = 0; i < limit; i++) {
    const job = await prisma.$transaction(async (tx) => {
      const row = await tx.googleAdPublishJob.findFirst({
        where: {
          status: 'QUEUED',
          ...(input.companyId ? { companyId: input.companyId } : {}),
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (!row) return null;

      return tx.googleAdPublishJob.update({
        where: { id: row.id },
        data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
        select: {
          id: true,
          attempts: true,
          maxAttempts: true,
          companyId: true,
          googleAdsIntegrationId: true,
          campaignId: true,
          adGroupId: true,
          assetGroupId: true,
          assetId: true,
          campaignType: true,
          googleCreativeDbId: true,
          headlinesOverride: true,
          descriptionsOverride: true,
          longHeadlineOverride: true,
          finalUrlOverride: true,
        },
      });
    });

    if (!job) break;

    try {
      const integration = await prisma.googleAdsIntegration.findUnique({
        where: { id: job.googleAdsIntegrationId },
        select: { customerId: true, loginCustomerId: true, refreshToken: true },
      });
      if (!integration?.customerId) throw new Error('Google Ads integration not configured');

      const { customerId, loginCustomerId, refreshToken } = integration;

      const campaign = await prisma.googleCampaign.findUnique({
        where: { id: job.campaignId },
        select: { googleCampaignId: true },
      });
      if (!campaign) throw new Error('Campaign not found');

      if (job.campaignType === 'PERFORMANCE_MAX') {
        await publishPmaxJob({
          job,
          customerId,
          loginCustomerId,
          refreshToken,
          campaignGoogleId: campaign.googleCampaignId,
        });
      } else {
        const adGroup = job.adGroupId
          ? await prisma.googleAdGroup.findUnique({
              where: { id: job.adGroupId },
              select: { googleAdGroupId: true },
            })
          : null;
        if (!adGroup) throw new Error('Ad group not found');

        if (job.campaignType === 'SEARCH') {
          await publishSearchJob({
            job,
            customerId,
            loginCustomerId,
            refreshToken,
            adGroupGoogleId: adGroup.googleAdGroupId,
          });
        } else {
          await publishDisplayJob({
            job,
            customerId,
            loginCustomerId,
            refreshToken,
            adGroupGoogleId: adGroup.googleAdGroupId,
          });
        }
      }

      await prisma.googleAdPublishJob.update({
        where: { id: job.id },
        data: { status: 'PUBLISHED', completedAt: new Date() },
      });

      processed.push({ id: job.id, status: 'PUBLISHED' });
    } catch (err) {
      const apiErr = googleAdsErrorFromRaw(err);
      const errMsg = apiErr.message;

      if (job.attempts >= job.maxAttempts) {
        await prisma.googleAdPublishJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', completedAt: new Date(), lastError: errMsg },
        });
        processed.push({ id: job.id, status: 'FAILED', error: errMsg });
      } else {
        await prisma.googleAdPublishJob.update({
          where: { id: job.id },
          data: { status: 'QUEUED', lastError: errMsg },
        });
        processed.push({ id: job.id, status: 'REQUEUED', error: errMsg });
      }
    }
  }

  return { processed };
}

type JobCore = {
  id: string;
  attempts: number;
  maxAttempts: number;
  companyId: string;
  googleAdsIntegrationId: string;
  campaignId: string;
  adGroupId: string | null;
  assetGroupId: string | null;
  assetId: string | null;
  campaignType: string;
  googleCreativeDbId: string | null;
  headlinesOverride: unknown;
  descriptionsOverride: unknown;
  longHeadlineOverride: string | null;
  finalUrlOverride: string | null;
};

async function publishSearchJob(input: {
  job: JobCore;
  customerId: string;
  loginCustomerId: string | null;
  refreshToken: string;
  adGroupGoogleId: string;
}) {
  const { job, customerId, loginCustomerId, refreshToken, adGroupGoogleId } = input;

  let creative = job.googleCreativeDbId
    ? await prisma.googleCreative.findUnique({ where: { id: job.googleCreativeDbId } })
    : null;

  const headlines = (job.headlinesOverride as string[] | null) ?? (creative?.headlines as string[] | null) ?? [];
  const descriptions = (job.descriptionsOverride as string[] | null) ?? (creative?.descriptions as string[] | null) ?? [];
  const finalUrl = job.finalUrlOverride ?? creative?.finalUrl ?? '';

  if (!headlines.length || !descriptions.length || !finalUrl) {
    throw new Error('Missing headlines, descriptions, or finalUrl for RSA');
  }

  const adGroupResourceName = `customers/${customerId}/adGroups/${adGroupGoogleId}`;
  const { id: googleAdId } = await createResponsiveSearchAd({
    refreshToken,
    customerId,
    loginCustomerId,
    rsa: {
      adGroupResourceName,
      headlines,
      descriptions,
      finalUrl,
      path1: creative?.path1 ?? undefined,
      path2: creative?.path2 ?? undefined,
      status: 'PAUSED',
    },
  });

  if (!creative && job.googleAdsIntegrationId) {
    creative = await prisma.googleCreative.create({
      data: {
        googleAdsIntegrationId: job.googleAdsIntegrationId,
        campaignId: job.campaignId,
        adType: 'RESPONSIVE_SEARCH',
        headlines,
        descriptions,
        finalUrl,
      },
    });
  }

  await prisma.googleAd.create({
    data: {
      googleAdsIntegrationId: job.googleAdsIntegrationId,
      adGroupId: job.adGroupId!,
      googleCreativeDbId: creative?.id,
      googleAdId,
      status: 'PAUSED',
      adType: 'RESPONSIVE_SEARCH',
      publishedAt: new Date(),
    },
  });

  await prisma.googleAdPublishJob.update({
    where: { id: job.id },
    data: { googleAdDbId: googleAdId },
  });
}

async function publishDisplayJob(input: {
  job: JobCore;
  customerId: string;
  loginCustomerId: string | null;
  refreshToken: string;
  adGroupGoogleId: string;
}) {
  const { job, customerId, loginCustomerId, refreshToken, adGroupGoogleId } = input;

  let creative = job.googleCreativeDbId
    ? await prisma.googleCreative.findUnique({ where: { id: job.googleCreativeDbId } })
    : null;

  const headlines = (job.headlinesOverride as string[] | null) ?? (creative?.headlines as string[] | null) ?? [];
  const descriptions = (job.descriptionsOverride as string[] | null) ?? (creative?.descriptions as string[] | null) ?? [];
  const longHeadline = job.longHeadlineOverride ?? creative?.longHeadline ?? headlines[0] ?? '';
  const finalUrl = job.finalUrlOverride ?? creative?.finalUrl ?? '';
  const businessName = creative?.businessName ?? '';

  if (!headlines.length || !finalUrl) throw new Error('Missing headlines or finalUrl for RDA');

  // Upload asset images if assetId is set
  const marketingImageResourceNames: string[] = [];
  const squareImageResourceNames: string[] = [];

  if (job.assetId) {
    const existing = await prisma.googleMedia.findFirst({
      where: { assetId: job.assetId, googleAdsIntegrationId: job.googleAdsIntegrationId },
    });
    if (existing) {
      marketingImageResourceNames.push(existing.googleAssetResourceName);
    } else {
      const uploaded = await uploadGalleryAssetToGoogle({
        googleAdsIntegrationId: job.googleAdsIntegrationId,
        assetId: job.assetId,
        assetType: 'IMAGE',
      });
      marketingImageResourceNames.push(uploaded.googleAssetResourceName);
    }
  }

  if (!marketingImageResourceNames.length) throw new Error('No images available for RDA');

  const adGroupResourceName = `customers/${customerId}/adGroups/${adGroupGoogleId}`;
  const { id: googleAdId } = await createResponsiveDisplayAd({
    refreshToken,
    customerId,
    loginCustomerId,
    rda: {
      adGroupResourceName,
      headlines,
      longHeadline,
      descriptions: descriptions.length ? descriptions : ['Learn more'],
      businessName,
      marketingImageResourceNames,
      squareImageResourceNames,
      finalUrl,
      status: 'PAUSED',
    },
  });

  if (!creative) {
    creative = await prisma.googleCreative.create({
      data: {
        googleAdsIntegrationId: job.googleAdsIntegrationId,
        campaignId: job.campaignId,
        adType: 'RESPONSIVE_DISPLAY',
        assetId: job.assetId,
        headlines,
        descriptions,
        longHeadline,
        finalUrl,
        businessName,
      },
    });
  }

  await prisma.googleAd.create({
    data: {
      googleAdsIntegrationId: job.googleAdsIntegrationId,
      adGroupId: job.adGroupId!,
      googleCreativeDbId: creative.id,
      googleAdId,
      status: 'PAUSED',
      adType: 'RESPONSIVE_DISPLAY',
      publishedAt: new Date(),
    },
  });

  await prisma.googleAdPublishJob.update({
    where: { id: job.id },
    data: { googleAdDbId: googleAdId },
  });
}

async function publishPmaxJob(input: {
  job: JobCore;
  customerId: string;
  loginCustomerId: string | null;
  refreshToken: string;
  campaignGoogleId: string;
}) {
  const { job, customerId, loginCustomerId, refreshToken, campaignGoogleId } = input;

  const creative = job.googleCreativeDbId
    ? await prisma.googleCreative.findUnique({ where: { id: job.googleCreativeDbId } })
    : null;

  const headlines = (job.headlinesOverride as string[] | null) ?? (creative?.headlines as string[] | null) ?? [];
  const descriptions = (job.descriptionsOverride as string[] | null) ?? (creative?.descriptions as string[] | null) ?? [];
  const longHeadline = job.longHeadlineOverride ?? creative?.longHeadline ?? headlines[0] ?? '';
  const finalUrl = job.finalUrlOverride ?? creative?.finalUrl ?? '';
  const businessName = creative?.businessName ?? '';

  if (!headlines.length || !finalUrl) throw new Error('Missing headlines or finalUrl for PMax');

  const campaignResourceName = `customers/${customerId}/campaigns/${campaignGoogleId}`;

  const { id: assetGroupGoogleId } = await createGoogleAssetGroup({
    refreshToken,
    customerId,
    loginCustomerId,
    campaignResourceName,
    assetGroup: {
      campaignResourceName,
      name: `Asset Group ${new Date().toISOString()}`,
      finalUrl,
      headlines,
      longHeadline,
      descriptions: descriptions.length ? descriptions : ['Learn more'],
      businessName,
      path1: creative?.path1 ?? undefined,
      path2: creative?.path2 ?? undefined,
    },
  });

  // Store asset group in DB
  await prisma.googleAssetGroup.create({
    data: {
      googleAdsIntegrationId: job.googleAdsIntegrationId,
      campaignId: job.campaignId,
      googleAssetGroupId: assetGroupGoogleId,
      status: 'PAUSED',
      finalUrl,
      path1: creative?.path1,
      path2: creative?.path2,
    },
  });

  await prisma.googleAdPublishJob.update({
    where: { id: job.id },
    data: { googleAdDbId: assetGroupGoogleId },
  });
}

/** Enqueue publish jobs for a set of groups (parallel to Meta enqueueBulkPublish). */
export async function enqueueGoogleBulkPublish(input: {
  companyId: string;
  googleAdsIntegrationId: string;
  campaignId: string;
  campaignType: string;
  scheduledAt?: Date | null;
  groups: Array<{
    assetIds: string[];
    adGroupId?: string;
    assetGroupId?: string;
    headlines?: string[];
    descriptions?: string[];
    longHeadline?: string;
    finalUrl?: string;
    googleCreativeDbId?: string;
  }>;
}): Promise<string[]> {
  const jobIds: string[] = [];

  for (const group of input.groups) {
    for (const assetId of group.assetIds.length ? group.assetIds : ['']) {
      const job = await prisma.googleAdPublishJob.create({
        data: {
          companyId: input.companyId,
          googleAdsIntegrationId: input.googleAdsIntegrationId,
          campaignId: input.campaignId,
          adGroupId: group.adGroupId ?? null,
          assetGroupId: group.assetGroupId ?? null,
          assetId: assetId || null,
          campaignType: input.campaignType,
          googleCreativeDbId: group.googleCreativeDbId ?? null,
          scheduledAt: input.scheduledAt ?? null,
          headlinesOverride: group.headlines ?? null,
          descriptionsOverride: group.descriptions ?? null,
          longHeadlineOverride: group.longHeadline ?? null,
          finalUrlOverride: group.finalUrl ?? null,
        },
        select: { id: true },
      });
      jobIds.push(job.id);
    }
  }

  return jobIds;
}
