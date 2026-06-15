import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { getAdAccountPixels } from '@/lib/meta/client';
import {
  applyConversionTrackingToggle,
  isConversionTrackingEnabled,
  normalizePromotedObject,
  optimizationGoalRequiresPixel,
  withConversionTrackingFlag,
} from '@/lib/meta/adset-preset-meta';
import {
  alignAdsetPresetToCampaignSiblings,
  isOptimizationDeliveryMismatchError,
} from '@/lib/meta/campaign-adset-alignment';
import { isLegacyObjectiveError, normalizeObjective } from '@/lib/meta/normalize-objective';
import { prisma } from '@/lib/prisma';

export function isPixelMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('pixel_id') ||
    m.includes('promoted_object') && m.includes('pixel') ||
    m.includes('no pixel was found')
  );
}

export function isSpecialAdCategoriesError(message: string): boolean {
  return /special_ad_categor/i.test(message);
}

/** Try account pixel, else disable conversion tracking with compatible goals. */
export async function tryFixAdsetDraftForPixelError(
  draft: AdsetPreset,
  campaignObjective: string | null | undefined,
  companyId: string,
): Promise<AdsetPreset | null> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { adAccountId: true },
  });
  if (!integration?.adAccountId) return null;

  try {
    const pixels = await getAdAccountPixels(integration.adAccountId, { companyId });
    const available = pixels.find((p) => p.is_unavailable !== true) ?? pixels[0];
    if (available?.id) {
      const po =
        draft.promotedObject && typeof draft.promotedObject === 'object'
          ? { ...(draft.promotedObject as Record<string, unknown>) }
          : {};
      const meta = normalizePromotedObject(po);
      return {
        ...draft,
        promotedObject: withConversionTrackingFlag(
          {
            ...po,
            pixel_id: available.id,
            custom_event_type: meta.custom_event_type || 'PURCHASE',
          },
          true,
        ),
      };
    }
  } catch (err) {
    console.error('[preset-error-recovery] pixel fetch failed:', err);
  }

  if (
    isConversionTrackingEnabled(draft.promotedObject) &&
    optimizationGoalRequiresPixel(draft.optimizationGoal, true)
  ) {
    const toggled = applyConversionTrackingToggle(draft, false, campaignObjective);
    return {
      ...draft,
      optimizationGoal: toggled.optimizationGoal ?? draft.optimizationGoal,
      bidStrategy: toggled.bidStrategy ?? draft.bidStrategy,
      bidConstraints: toggled.bidConstraints as AdsetPreset['bidConstraints'],
      promotedObject: toggled.promotedObject,
    };
  }

  return null;
}

export async function tryFixAdsetDraftForOptimizationMismatch(
  draft: AdsetPreset,
  campaignDbId: string,
): Promise<AdsetPreset | null> {
  const { draft: aligned, convention } = await alignAdsetPresetToCampaignSiblings(
    campaignDbId,
    draft,
  );
  if (!convention) return null;
  if (
    aligned.optimizationGoal === draft.optimizationGoal &&
    aligned.billingEvent === draft.billingEvent
  ) {
    return null;
  }
  return aligned;
}

export function tryFixCampaignDraftForError(
  draft: CampaignPreset,
  errorMessage: string,
): CampaignPreset | null {
  if (isLegacyObjectiveError(errorMessage)) {
    const normalized = normalizeObjective(draft.objective);
    if (normalized !== draft.objective) {
      return { ...draft, objective: normalized };
    }
    // Objective was already OUTCOME_* — fall through to LLM
  }
  if (isSpecialAdCategoriesError(errorMessage)) {
    const cats = draft.specialAdCategories;
    if (!cats || cats.length === 0) {
      return { ...draft, specialAdCategories: ['NONE'] };
    }
  }
  if (/is_adset_budget_sharing_enabled/i.test(errorMessage)) {
    if (draft.isAdsetBudgetSharingEnabled == null) {
      return { ...draft, isAdsetBudgetSharingEnabled: false };
    }
  }
  return null;
}
