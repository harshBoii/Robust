import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import {
  billingEventsForCampaign,
  optimizationGoalsForCampaign,
  withConversionTrackingFlag,
} from '@/lib/meta/adset-preset-meta';
import { ensureTargetingPlacements } from '@/lib/meta/targeting';

import type { WorkflowState } from './types';

export function defaultCampaignDraft(objective = 'OUTCOME_TRAFFIC'): CampaignPreset {
  return {
    id: '',
    name: 'Chat Campaign',
    isDefault: false,
    objective,
    status: 'PAUSED',
    spendCap: null,
    dailyBudget: null,
    lifetimeBudget: null,
    bidStrategy: null,
    specialAdCategories: [],
    isAdsetBudgetSharingEnabled: null,
  };
}

export function defaultAdsetDraft(): AdsetPreset {
  return {
    id: '',
    name: 'Chat Ad Set',
    isDefault: false,
    pinnedCampaignId: null,
    dailyBudget: '2000',
    lifetimeBudget: null,
    scheduleDuration: '1_week',
    scheduleCustomEnd: null,
    billingEvent: 'IMPRESSIONS',
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    destinationType: 'WEBSITE',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    bidAmount: null,
    isDefaultCreative: false,
    pacingType: 'standard',
    promotedObject: withConversionTrackingFlag(
      { pixel_id: '', custom_event_type: 'PURCHASE' },
      true,
    ),
    attributionSpec: null,
    targeting: ensureTargetingPlacements({
      age_min: 25,
      age_max: 45,
      geo_locations: { countries: ['IN'] },
    }),
    bidConstraints: null,
  };
}

export function workflowHasPixel(state: Pick<WorkflowState, 'hasPixel' | 'pixelId'>): boolean {
  return Boolean(state.hasPixel || state.pixelId?.trim());
}

/** Seed ad set draft from approved / draft campaign for valid Meta combos. */
export function buildAdsetDraftFromCampaign(
  campaign: CampaignPreset,
  campaignId?: string | null,
  workflow?: Pick<WorkflowState, 'hasPixel' | 'pixelId' | 'trafficOptimizationGoal'>,
): AdsetPreset {
  const base = defaultAdsetDraft();
  const objective = campaign.objective ?? 'OUTCOME_TRAFFIC';
  const hasPixel = workflow ? workflowHasPixel(workflow) : false;
  const pixelId = workflow?.pixelId?.trim() || '';
  const billingEvents = billingEventsForCampaign(objective);
  const optGoals = optimizationGoalsForCampaign(objective);
  const campaignHasBudget = Boolean(campaign.dailyBudget || campaign.lifetimeBudget);

  let optimizationGoal = optGoals.includes(base.optimizationGoal as (typeof optGoals)[number])
    ? base.optimizationGoal
    : (optGoals[0] ?? base.optimizationGoal);
  let billingEvent = billingEvents[0] ?? base.billingEvent;
  let promotedObject = base.promotedObject;

  if (!hasPixel) {
    if (objective === 'OUTCOME_TRAFFIC') {
      optimizationGoal =
        workflow?.trafficOptimizationGoal === 'LANDING_PAGE_VIEWS'
          ? 'LANDING_PAGE_VIEWS'
          : 'LINK_CLICKS';
      billingEvent = 'LINK_CLICKS';
      promotedObject = withConversionTrackingFlag({}, false);
    } else if (objective === 'OUTCOME_ENGAGEMENT') {
      optimizationGoal = 'POST_ENGAGEMENT';
      billingEvent = 'IMPRESSIONS';
      promotedObject = withConversionTrackingFlag({}, false);
    } else if (objective === 'OUTCOME_AWARENESS') {
      optimizationGoal = 'REACH';
      billingEvent = 'IMPRESSIONS';
      promotedObject = withConversionTrackingFlag({}, false);
    }
  } else if (pixelId) {
    promotedObject = withConversionTrackingFlag(
      { pixel_id: pixelId, custom_event_type: 'PURCHASE' },
      true,
    );
  }

  return {
    ...base,
    name: campaign.name ? `${campaign.name} — Ad set` : base.name,
    pinnedCampaignId: campaignId ?? null,
    billingEvent,
    optimizationGoal,
    promotedObject,
    bidStrategy: campaign.bidStrategy ?? base.bidStrategy,
    dailyBudget: campaignHasBudget ? null : base.dailyBudget,
    lifetimeBudget: null,
  };
}
