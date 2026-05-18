import type { z } from 'zod';

import {
  adsetPresetPatchSchema,
  campaignPresetPatchSchema,
  creativeSuggestResponseSchema,
  type AdsetPresetPatch,
  type CampaignPresetPatch,
  type CreativeSuggestResponse,
} from './schemas';

export function pickValidFields<T extends z.ZodRawShape>(
  raw: unknown,
  shape: T,
): { applied: Partial<z.infer<z.ZodObject<T>>>; skippedFields: string[] } {
  const applied: Record<string, unknown> = {};
  const skippedFields: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { applied: {} as Partial<z.infer<z.ZodObject<T>>>, skippedFields };
  }

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const result = fieldSchema.safeParse(value);
    if (result.success) applied[key] = result.data;
    else skippedFields.push(key);
  }
  return {
    applied: applied as Partial<z.infer<z.ZodObject<T>>>,
    skippedFields,
  };
}

export type ValidateWithRetryResult<T> = {
  data: T | null;
  skippedFields: string[];
  partial: boolean;
};

export function validateFullOrPartial<T extends z.ZodObject<z.ZodRawShape>>(
  raw: unknown,
  schema: T,
  attempt: 1 | 2,
): ValidateWithRetryResult<z.infer<T>> {
  const full = schema.safeParse(raw);
  if (full.success) {
    return { data: full.data, skippedFields: [], partial: false };
  }

  if (attempt === 1) {
    return { data: null, skippedFields: [], partial: false };
  }

  const { applied, skippedFields } = pickValidFields(raw, schema.shape);
  if (Object.keys(applied).length > 0) {
    return { data: applied as z.infer<T>, skippedFields, partial: true };
  }

  return { data: null, skippedFields: [], partial: false };
}

export function validatePresetBuilderPartial(raw: unknown): {
  campaign: Partial<CampaignPresetPatch> | null;
  adset: Partial<AdsetPresetPatch> | null;
  skippedFields: string[];
  explanation: string;
} {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const explanation = typeof obj.explanation === 'string' ? obj.explanation : '';

  const campaignResult = pickValidFields(obj.campaign, campaignPresetPatchSchema.shape);
  const adsetResult = pickValidFields(obj.adset, adsetPresetPatchSchema.shape);

  const skippedFields = [
    ...campaignResult.skippedFields.map((k) => `campaign.${k}`),
    ...adsetResult.skippedFields.map((k) => `adset.${k}`),
  ];

  return {
    campaign: Object.keys(campaignResult.applied).length > 0 ? campaignResult.applied : null,
    adset: Object.keys(adsetResult.applied).length > 0 ? adsetResult.applied : null,
    skippedFields,
    explanation,
  };
}

export function validateCreativePartial(raw: unknown): {
  data: Partial<CreativeSuggestResponse> | null;
  skippedFields: string[];
} {
  const { applied, skippedFields } = pickValidFields(raw, creativeSuggestResponseSchema.shape);
  return {
    data: Object.keys(applied).length > 0 ? applied : null,
    skippedFields,
  };
}
