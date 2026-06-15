import 'server-only';

import type { AdsetPreset } from '@/app/components/manager/presets/types';
import type { BillingEvent, OptimizationGoal } from '@/lib/meta/adset-preset-meta';
import { prisma } from '@/lib/prisma';

export type CampaignAdSetConvention = {
  optimizationGoal: OptimizationGoal;
  billingEvent: BillingEvent;
  bidStrategy: string | null;
  sourceAdSetId: string;
  sourceAdSetName: string | null;
  campaignBidStrategy: string | null;
  siblingCount: number;
};

const LOWEST_COST_BID_STRATEGIES = new Set([
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
  'LOWEST_COST_WITH_MIN_ROAS',
]);

export function isLowestCostCampaignBidStrategy(bidStrategy: string | null | undefined): boolean {
  if (!bidStrategy) return true;
  return LOWEST_COST_BID_STRATEGIES.has(bidStrategy);
}

export function isOptimizationDeliveryMismatchError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('optimisation for ad delivery') ||
    m.includes('optimization for ad delivery') ||
    (m.includes('lowest cost') && m.includes('optim') && m.includes('ad delivery'))
  );
}

/** Load optimization/billing convention from existing ad sets on a campaign. */
export async function getCampaignAdSetConvention(
  campaignDbId: string,
): Promise<CampaignAdSetConvention | null> {
  const [campaign, adsets] = await Promise.all([
    prisma.metaCampaign.findUnique({
      where: { id: campaignDbId },
      select: { bidStrategy: true },
    }),
    prisma.metaAdSet.findMany({
      where: {
        campaignId: campaignDbId,
        OR: [{ status: null }, { status: { not: 'ARCHIVED' } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        optimizationGoal: true,
        billingEvent: true,
        bidStrategy: true,
      },
    }),
  ]);

  const template = adsets.find((a) => a.optimizationGoal?.trim());
  if (!template?.optimizationGoal) return null;

  return {
    optimizationGoal: template.optimizationGoal as OptimizationGoal,
    billingEvent: (template.billingEvent ?? 'IMPRESSIONS') as BillingEvent,
    bidStrategy: template.bidStrategy ?? campaign?.bidStrategy ?? null,
    sourceAdSetId: template.id,
    sourceAdSetName: template.name,
    campaignBidStrategy: campaign?.bidStrategy ?? null,
    siblingCount: adsets.length,
  };
}

export function alignAdsetPresetToConvention(
  draft: AdsetPreset,
  convention: CampaignAdSetConvention,
): AdsetPreset {
  const mustMatch =
    isLowestCostCampaignBidStrategy(convention.campaignBidStrategy) ||
    convention.siblingCount > 0;

  if (!mustMatch) return draft;

  if (
    draft.optimizationGoal === convention.optimizationGoal &&
    draft.billingEvent === convention.billingEvent
  ) {
    return draft;
  }

  return {
    ...draft,
    optimizationGoal: convention.optimizationGoal,
    billingEvent: convention.billingEvent,
    bidStrategy: convention.bidStrategy ?? draft.bidStrategy,
  };
}

export async function alignAdsetPresetToCampaignSiblings(
  campaignDbId: string,
  draft: AdsetPreset,
): Promise<{ draft: AdsetPreset; convention: CampaignAdSetConvention | null }> {
  const convention = await getCampaignAdSetConvention(campaignDbId);
  if (!convention) return { draft, convention: null };
  return {
    draft: alignAdsetPresetToConvention(draft, convention),
    convention,
  };
}

export function formatConventionForLlm(convention: CampaignAdSetConvention): string {
  return [
    'Existing ad sets on this campaign (Meta rule: lowest-cost campaigns require the SAME optimization_goal on every ad set):',
    `- optimizationGoal: ${convention.optimizationGoal}`,
    `- billingEvent: ${convention.billingEvent}`,
    convention.campaignBidStrategy
      ? `- campaign bidStrategy: ${convention.campaignBidStrategy}`
      : null,
    convention.sourceAdSetName
      ? `- matched sibling: "${convention.sourceAdSetName}"`
      : `- matched sibling ad set id: ${convention.sourceAdSetId}`,
    `Do NOT change optimizationGoal or billingEvent away from these values when adding another ad set.`,
  ]
    .filter(Boolean)
    .join('\n');
}
