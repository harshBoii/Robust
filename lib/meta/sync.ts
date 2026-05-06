import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  createAdSet,
  createCampaign,
  getAdSetsForCampaign,
  getCampaignsForAccount,
} from '@/lib/meta/client';

export async function syncCampaigns(metaIntegrationId: string) {
  const integration = await prisma.metaIntegration.findUnique({
    where: { id: metaIntegrationId },
    select: { id: true, adAccountId: true },
  });
  if (!integration) throw new Error('Meta integration not found');

  const rows = await getCampaignsForAccount({ adAccountId: integration.adAccountId });

  for (const c of rows) {
    if (!c.id) continue;
    await prisma.metaCampaign.upsert({
      where: {
        metaIntegrationId_metaCampaignId: {
          metaIntegrationId: integration.id,
          metaCampaignId: c.id,
        },
      },
      create: {
        metaIntegrationId: integration.id,
        metaCampaignId: c.id,
        name: c.name ?? c.id,
        objective: c.objective ?? 'UNKNOWN',
        status: (c.status as string) ?? 'ACTIVE',
        dailyBudget: c.daily_budget ? Number(c.daily_budget) : 0,
        lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) : null,
        spendCap: c.spend_cap ? BigInt(c.spend_cap) : null,
        bidStrategy: c.bid_strategy ?? null,
        specialAdCategory: null,
        specialAdCategories: c.special_ad_categories ?? [],
      },
      update: {
        name: c.name ?? c.id,
        objective: c.objective ?? 'UNKNOWN',
        status: (c.status as string) ?? 'ACTIVE',
        dailyBudget: c.daily_budget ? Number(c.daily_budget) : 0,
        lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) : null,
        spendCap: c.spend_cap ? BigInt(c.spend_cap) : null,
        bidStrategy: c.bid_strategy ?? null,
        specialAdCategories: c.special_ad_categories ?? [],
      },
    });
  }

  return prisma.metaCampaign.findMany({
    where: { metaIntegrationId: integration.id },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    select: {
      id: true,
      metaCampaignId: true,
      name: true,
      objective: true,
      status: true,
      dailyBudget: true,
      lifetimeBudget: true,
      bidStrategy: true,
      spendCap: true,
      specialAdCategories: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function syncAdSets(input: {
  metaIntegrationId: string;
  campaignDbId: string;
}) {
  const integration = await prisma.metaIntegration.findUnique({
    where: { id: input.metaIntegrationId },
    select: { id: true, adAccountId: true },
  });
  if (!integration) throw new Error('Meta integration not found');

  const campaign = await prisma.metaCampaign.findUnique({
    where: { id: input.campaignDbId },
    select: { id: true, metaCampaignId: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const rows = await getAdSetsForCampaign({ metaCampaignId: campaign.metaCampaignId });

  for (const a of rows) {
    if (!a.id) continue;
    await prisma.metaAdSet.upsert({
      where: {
        metaIntegrationId_metaAdSetId: {
          metaIntegrationId: integration.id,
          metaAdSetId: a.id,
        },
      },
      create: {
        metaIntegrationId: integration.id,
        metaAdSetId: a.id,
        campaignId: campaign.id,
        name: a.name ?? a.id,
        status: (a.status as string) ?? 'ACTIVE',
        dailyBudget: a.daily_budget ? Number(a.daily_budget) : null,
        lifetimeBudget: a.lifetime_budget ? Number(a.lifetime_budget) : null,
        bidStrategy: a.bid_strategy ?? null,
        bidAmount: a.bid_amount ? Number(a.bid_amount) : null,
        bidConstraints: {},
        optimizationGoal: a.optimization_goal ?? null,
        billingEvent: a.billing_event ?? null,
        targeting: a.targeting ?? null,
        startTime: a.start_time ? new Date(a.start_time) : null,
        endTime: a.end_time ? new Date(a.end_time) : null,
      },
      update: {
        name: a.name ?? a.id,
        status: (a.status as string) ?? 'ACTIVE',
        dailyBudget: a.daily_budget ? Number(a.daily_budget) : null,
        lifetimeBudget: a.lifetime_budget ? Number(a.lifetime_budget) : null,
        bidStrategy: a.bid_strategy ?? null,
        bidAmount: a.bid_amount ? Number(a.bid_amount) : null,
        optimizationGoal: a.optimization_goal ?? null,
        billingEvent: a.billing_event ?? null,
        targeting: a.targeting ?? null,
        startTime: a.start_time ? new Date(a.start_time) : null,
        endTime: a.end_time ? new Date(a.end_time) : null,
      },
    });
  }

  return prisma.metaAdSet.findMany({
    where: {
      metaIntegrationId: integration.id,
      campaignId: campaign.id,
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    select: {
      id: true,
      metaAdSetId: true,
      name: true,
      status: true,
      dailyBudget: true,
      lifetimeBudget: true,
      bidStrategy: true,
      bidAmount: true,
      optimizationGoal: true,
      billingEvent: true,
      targeting: true,
      startTime: true,
      endTime: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createAndStoreCampaignFromPreset(input: {
  metaIntegrationId: string;
  presetId: string;
  name?: string;
}) {
  const integration = await prisma.metaIntegration.findUnique({
    where: { id: input.metaIntegrationId },
    select: { id: true, adAccountId: true },
  });
  if (!integration) throw new Error('Meta integration not found');

  const preset = await prisma.campaignPreset.findUnique({
    where: { id: input.presetId },
  });
  if (!preset) throw new Error('Campaign preset not found');

  const created = await createCampaign({
    adAccountId: integration.adAccountId,
    name: input.name ?? preset.name,
    objective: preset.objective ?? 'OUTCOME_TRAFFIC',
    status: (typeof preset.status === 'string' ? preset.status : undefined) ?? 'PAUSED',
    bidStrategy: preset.bidStrategy,
    dailyBudget: preset.dailyBudget ? Number(preset.dailyBudget) : null,
    lifetimeBudget: preset.lifetimeBudget ? Number(preset.lifetimeBudget) : null,
    spendCap: preset.spendCap ? Number(preset.spendCap) : null,
    specialAdCategories: Array.isArray(preset.specialAdCategories)
      ? (preset.specialAdCategories as string[])
      : [],
  });

  return prisma.metaCampaign.create({
    data: {
      metaIntegrationId: integration.id,
      metaCampaignId: created.id,
      campaignPresetId: preset.id,
      name: input.name ?? preset.name,
      objective: preset.objective ?? 'OUTCOME_TRAFFIC',
      status: preset.status ?? 'PAUSED',
      dailyBudget: preset.dailyBudget ? Number(preset.dailyBudget) : 0,
      lifetimeBudget: preset.lifetimeBudget ? Number(preset.lifetimeBudget) : null,
      spendCap: preset.spendCap ?? null,
      bidStrategy: preset.bidStrategy,
      specialAdCategory: null,
      specialAdCategories: preset.specialAdCategories,
    },
    select: { id: true, metaCampaignId: true, name: true, objective: true, status: true },
  });
}

export async function createAndStoreAdSetFromPreset(input: {
  metaIntegrationId: string;
  campaignDbId: string;
  presetId: string;
  name?: string;
}) {
  const integration = await prisma.metaIntegration.findUnique({
    where: { id: input.metaIntegrationId },
    select: { id: true, adAccountId: true },
  });
  if (!integration) throw new Error('Meta integration not found');

  const campaign = await prisma.metaCampaign.findUnique({
    where: { id: input.campaignDbId },
    select: { id: true, metaCampaignId: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const preset = await prisma.adsetPreset.findUnique({ where: { id: input.presetId } });
  if (!preset) throw new Error('Adset preset not found');

  const created = await createAdSet({
    adAccountId: integration.adAccountId,
    name: input.name ?? preset.name,
    campaignId: campaign.metaCampaignId,
    status: 'PAUSED',
    dailyBudget: preset.dailyBudget ? Number(preset.dailyBudget) : null,
    lifetimeBudget: preset.lifetimeBudget ? Number(preset.lifetimeBudget) : null,
    bidStrategy: preset.bidStrategy,
    bidAmount: preset.bidAmount ? Number(preset.bidAmount) : null,
    optimizationGoal: null,
    billingEvent: null,
    targeting: (preset.targeting as Record<string, unknown>) ?? null,
    startTime: preset.startTime ? preset.startTime.toISOString() : null,
    endTime: preset.endTime ? preset.endTime.toISOString() : null,
  });

  return prisma.metaAdSet.create({
    data: {
      metaIntegrationId: integration.id,
      campaignId: campaign.id,
      adsetPresetId: preset.id,
      metaAdSetId: created.id,
      name: input.name ?? preset.name,
      status: 'PAUSED',
      dailyBudget: preset.dailyBudget ? Number(preset.dailyBudget) : null,
      lifetimeBudget: preset.lifetimeBudget ? Number(preset.lifetimeBudget) : null,
      bidStrategy: preset.bidStrategy,
      bidAmount: preset.bidAmount ? Number(preset.bidAmount) : null,
      bidConstraints: preset.bidConstraints ?? {},
      optimizationGoal: null,
      billingEvent: null,
      targeting: preset.targeting,
      startTime: preset.startTime,
      endTime: preset.endTime,
    },
    select: { id: true, metaAdSetId: true, name: true, status: true },
  });
}

