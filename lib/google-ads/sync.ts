import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  createGoogleCampaign,
  createGoogleAdGroup,
  getCampaignsForCustomer,
  getAdGroupsForCampaign,
  type GoogleCampaignType,
} from '@/lib/google-ads/client';
import type { GoogleCampaignPreset, GoogleAdGroupPreset } from '@/lib/google-ads/types';

export async function syncGoogleCampaigns(googleAdsIntegrationId: string) {
  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { id: googleAdsIntegrationId },
    select: { id: true, customerId: true, loginCustomerId: true, refreshToken: true, companyId: true },
  });
  if (!integration?.customerId) return [];

  const rows = await getCampaignsForCustomer({
    refreshToken: integration.refreshToken,
    customerId: integration.customerId,
    loginCustomerId: integration.loginCustomerId,
  });

  for (const c of rows) {
    if (!c.id) continue;
    await prisma.googleCampaign.upsert({
      where: {
        googleAdsIntegrationId_googleCampaignId: {
          googleAdsIntegrationId: integration.id,
          googleCampaignId: c.id,
        },
      },
      create: {
        googleAdsIntegrationId: integration.id,
        googleCampaignId: c.id,
        name: c.name ?? c.id,
        campaignType: normalizeCampaignType(c.type),
        status: c.status ?? 'PAUSED',
        dailyBudgetMicros: c.dailyBudgetMicros ? BigInt(c.dailyBudgetMicros) : null,
      },
      update: {
        name: c.name ?? c.id,
        campaignType: normalizeCampaignType(c.type),
        status: c.status ?? 'PAUSED',
        dailyBudgetMicros: c.dailyBudgetMicros ? BigInt(c.dailyBudgetMicros) : null,
      },
    });
  }

  return prisma.googleCampaign.findMany({
    where: { googleAdsIntegrationId: integration.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function syncGoogleAdGroups(input: {
  googleAdsIntegrationId: string;
  campaignDbId: string;
}) {
  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { id: input.googleAdsIntegrationId },
    select: { id: true, customerId: true, loginCustomerId: true, refreshToken: true },
  });
  const campaign = await prisma.googleCampaign.findUnique({
    where: { id: input.campaignDbId },
    select: { googleCampaignId: true },
  });
  if (!integration?.customerId || !campaign) return [];

  const rows = await getAdGroupsForCampaign({
    refreshToken: integration.refreshToken,
    customerId: integration.customerId,
    loginCustomerId: integration.loginCustomerId,
    campaignId: campaign.googleCampaignId,
  });

  for (const ag of rows) {
    if (!ag.id) continue;
    await prisma.googleAdGroup.upsert({
      where: {
        googleAdsIntegrationId_googleAdGroupId: {
          googleAdsIntegrationId: integration.id,
          googleAdGroupId: ag.id,
        },
      },
      create: {
        googleAdsIntegrationId: integration.id,
        campaignId: input.campaignDbId,
        googleAdGroupId: ag.id,
        name: ag.name ?? ag.id,
        status: ag.status ?? 'PAUSED',
        cpcBidMicros: ag.cpcBidMicros ? BigInt(ag.cpcBidMicros) : null,
      },
      update: {
        name: ag.name ?? ag.id,
        status: ag.status ?? 'PAUSED',
        cpcBidMicros: ag.cpcBidMicros ? BigInt(ag.cpcBidMicros) : null,
      },
    });
  }

  return prisma.googleAdGroup.findMany({
    where: { campaignId: input.campaignDbId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAndStoreGoogleCampaignFromPreset(input: {
  googleAdsIntegrationId: string;
  presetId: string;
  name?: string;
}) {
  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { id: input.googleAdsIntegrationId },
    select: { id: true, customerId: true, loginCustomerId: true, refreshToken: true },
  });
  if (!integration?.customerId) throw new Error('Google Ads integration not configured');

  const preset = await prisma.googleCampaignPreset.findUnique({
    where: { id: input.presetId },
  });
  if (!preset) throw new Error('Campaign preset not found');

  const { id, resourceName } = await createGoogleCampaign({
    refreshToken: integration.refreshToken,
    customerId: integration.customerId,
    loginCustomerId: integration.loginCustomerId,
    campaign: {
      name: input.name ?? preset.name,
      campaignType: preset.campaignType as GoogleCampaignType,
      biddingStrategy: preset.biddingStrategy ?? undefined,
      dailyBudgetMicros: preset.dailyBudgetMicros ? Number(preset.dailyBudgetMicros) : undefined,
      totalBudgetMicros: preset.totalBudgetMicros ? Number(preset.totalBudgetMicros) : undefined,
      targetCpaMicros: preset.targetCpaMicros ? Number(preset.targetCpaMicros) : undefined,
      targetRoas: preset.targetRoas ?? undefined,
    },
  });

  void resourceName;

  const campaign = await prisma.googleCampaign.create({
    data: {
      googleAdsIntegrationId: integration.id,
      googleCampaignId: id,
      campaignPresetId: preset.id,
      name: input.name ?? preset.name,
      campaignType: preset.campaignType,
      status: 'PAUSED',
      biddingStrategy: preset.biddingStrategy,
      dailyBudgetMicros: preset.dailyBudgetMicros,
      publishedAt: new Date(),
    },
  });

  return campaign;
}

export async function createAndStoreGoogleAdGroupFromPreset(input: {
  googleAdsIntegrationId: string;
  campaignDbId: string;
  presetId: string;
  name?: string;
}) {
  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { id: input.googleAdsIntegrationId },
    select: { id: true, customerId: true, loginCustomerId: true, refreshToken: true },
  });
  if (!integration?.customerId) throw new Error('Google Ads integration not configured');

  const campaign = await prisma.googleCampaign.findUnique({
    where: { id: input.campaignDbId },
    select: { googleCampaignId: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const preset = await prisma.googleAdGroupPreset.findUnique({
    where: { id: input.presetId },
  });
  if (!preset) throw new Error('Ad group preset not found');

  const campaignResourceName = `customers/${integration.customerId}/campaigns/${campaign.googleCampaignId}`;

  const { id: adGroupId } = await createGoogleAdGroup({
    refreshToken: integration.refreshToken,
    customerId: integration.customerId,
    loginCustomerId: integration.loginCustomerId,
    adGroup: {
      campaignResourceName,
      name: input.name ?? preset.name,
      cpcBidMicros: preset.cpcBidMicros ? Number(preset.cpcBidMicros) : undefined,
    },
  });

  const adGroup = await prisma.googleAdGroup.create({
    data: {
      googleAdsIntegrationId: integration.id,
      campaignId: input.campaignDbId,
      googleAdGroupId: adGroupId,
      adGroupPresetId: preset.id,
      name: input.name ?? preset.name,
      status: 'PAUSED',
      keywords: Array.isArray(preset.keywords) ? preset.keywords : [],
      targeting: typeof preset.targeting === 'object' && preset.targeting !== null
        ? preset.targeting
        : {},
      cpcBidMicros: preset.cpcBidMicros,
    },
  });

  return adGroup;
}

function normalizeCampaignType(type: string): string {
  if (type === 'PERFORMANCE_MAX') return 'PERFORMANCE_MAX';
  if (type === 'DISPLAY') return 'DISPLAY';
  return 'SEARCH';
}

// Re-export types for callers
export type { GoogleCampaignPreset, GoogleAdGroupPreset };
