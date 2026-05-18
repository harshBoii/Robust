import {
  DEFAULT_BILLING_EVENT,
  DEFAULT_OPTIMIZATION_GOAL,
  normalizePromotedObject,
  validateAdsetPresetMeta,
} from '@/lib/meta/adset-preset-meta';

import { sanitizeMetaTargeting } from '@/lib/meta/targeting';

import type { AdsetPreset, AnyObj, CampaignPreset, MetaCampaignOption } from './types';

export function parseJsonArray<T>(v: string): T[] | null {
  if (!v.trim()) return [];
  try {
    const p = JSON.parse(v) as unknown;
    return Array.isArray(p) ? (p as T[]) : null;
  } catch {
    return null;
  }
}

export function buildCampaignPresetBody(draft: CampaignPreset) {
  return {
    name: draft.name,
    isDefault: draft.isDefault,
    objective: draft.objective,
    status: draft.status,
    spendCap: draft.spendCap ? Number(draft.spendCap) : null,
    dailyBudget: draft.dailyBudget ? Number(draft.dailyBudget) : null,
    lifetimeBudget: draft.lifetimeBudget ? Number(draft.lifetimeBudget) : null,
    bidStrategy: draft.bidStrategy,
    specialAdCategories: draft.specialAdCategories ?? [],
    isAdsetBudgetSharingEnabled: draft.isAdsetBudgetSharingEnabled,
  };
}

export function campaignUsesAdsetBudget(draft: CampaignPreset): boolean {
  return !draft.dailyBudget?.trim() && !draft.lifetimeBudget?.trim();
}

export function validateCampaignPresetDraft(draft: CampaignPreset): string | null {
  if (!draft.name.trim()) return 'Please name this preset.';
  if (campaignUsesAdsetBudget(draft) && draft.isAdsetBudgetSharingEnabled == null) {
    return 'Choose whether ad set budget sharing is enabled (required when budget is on ad sets, not the campaign).';
  }
  return null;
}

export function buildAdsetPresetBody(
  draft: AdsetPreset,
  options: {
    advancedTargetingJson?: string;
    metaCampaigns?: MetaCampaignOption[];
  } = {},
): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  if (!draft.name.trim()) return { ok: false, error: 'Please name this preset.' };
  if (draft.scheduleDuration === 'custom' && !draft.scheduleCustomEnd) {
    return { ok: false, error: 'Pick a custom end date for the schedule.' };
  }

  const pinnedMeta = options.metaCampaigns?.find((c) => c.id === draft.pinnedCampaignId);
  const campaignObjective =
    draft.pinnedCampaign?.objective ?? pinnedMeta?.objective ?? 'OUTCOME_SALES';
  const metaCheck = validateAdsetPresetMeta({
    billingEvent: draft.billingEvent ?? DEFAULT_BILLING_EVENT,
    optimizationGoal: draft.optimizationGoal ?? DEFAULT_OPTIMIZATION_GOAL,
    promotedObject: draft.promotedObject,
    bidStrategy: draft.bidStrategy,
    bidAmount: draft.bidAmount,
    bidConstraints: draft.bidConstraints,
    campaignObjective,
  });
  if (!metaCheck.ok) return { ok: false, error: metaCheck.error };

  let targeting: AnyObj = draft.targeting ?? {};
  const advanced = options.advancedTargetingJson?.trim();
  if (advanced) {
    try {
      targeting = JSON.parse(advanced) as AnyObj;
    } catch {
      return { ok: false, error: 'Fix the Advanced targeting JSON.' };
    }
  }
  const sanitizedTargeting = sanitizeMetaTargeting(targeting) ?? {
    targeting_automation: { advantage_audience: 1 },
  };

  return {
    ok: true,
    body: {
      name: draft.name,
      isDefault: draft.isDefault,
      pinnedCampaignId: draft.pinnedCampaignId,
      dailyBudget: draft.dailyBudget ? Number(draft.dailyBudget) : null,
      lifetimeBudget: draft.lifetimeBudget ? Number(draft.lifetimeBudget) : null,
      scheduleDuration: draft.scheduleDuration,
      scheduleCustomEnd: draft.scheduleCustomEnd,
      billingEvent: draft.billingEvent,
      optimizationGoal: draft.optimizationGoal,
      destinationType: draft.destinationType,
      bidStrategy: draft.bidStrategy,
      bidAmount: draft.bidAmount ? Number(draft.bidAmount) : null,
      isDefaultCreative: draft.isDefaultCreative,
      pacingType: draft.pacingType,
      promotedObject: draft.promotedObject,
      attributionSpec: draft.attributionSpec,
      targeting: sanitizedTargeting,
      bidConstraints: draft.bidConstraints ?? {},
    },
  };
}
