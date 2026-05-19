import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { ensureTargetingPlacements } from '@/lib/meta/targeting';

import type { AdsetPresetPatch, CampaignPresetPatch } from './schemas';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function mergeCampaignPresetPatch(
  draft: CampaignPreset,
  patch: Partial<CampaignPresetPatch>,
): CampaignPreset {
  const merged = deepMerge(draft as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  return merged as unknown as CampaignPreset;
}

export function mergeAdsetPresetPatch(draft: AdsetPreset, patch: Partial<AdsetPresetPatch>): AdsetPreset {
  const merged = deepMerge(draft as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  if (merged.targeting && typeof merged.targeting === 'object') {
    merged.targeting = ensureTargetingPlacements(merged.targeting as Record<string, unknown>);
  }
  return merged as unknown as AdsetPreset;
}

/** Build apply patch for creative fields, omitting skipped keys. */
export function buildCreativeApplyPatch(
  data: Partial<{
    headline: string;
    primaryText: string;
    description?: string;
    ctaType: string;
    landingUrl?: string;
  }>,
  skippedFields: string[],
): Record<string, string> {
  const skip = new Set(skippedFields);
  const patch: Record<string, string> = {};
  if (data.headline && !skip.has('headline')) patch.headline = data.headline;
  if (data.primaryText && !skip.has('primaryText')) patch.primaryText = data.primaryText;
  if (data.description && !skip.has('description')) patch.description = data.description;
  if (data.ctaType && !skip.has('ctaType')) patch.ctaType = data.ctaType;
  if (data.landingUrl && !skip.has('landingUrl')) patch.landingUrl = data.landingUrl;
  return patch;
}
