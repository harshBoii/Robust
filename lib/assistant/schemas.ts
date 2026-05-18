import { z } from 'zod';

import { BILLING_EVENT_OPTIONS, OPTIMIZATION_GOAL_OPTIONS } from '@/lib/meta/adset-preset-meta';

import {
  BID_STRATEGY_OPTIONS,
  CAMPAIGN_OBJECTIVE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  CTA_OPTIONS,
  DESTINATION_TYPE_OPTIONS,
  PACING_TYPE_OPTIONS,
  SCHEDULE_DURATION_OPTIONS,
  SPECIAL_AD_CATEGORY_OPTIONS,
} from './constants';

const billingEvents = BILLING_EVENT_OPTIONS.map((o) => o.value);
const optimizationGoals = OPTIMIZATION_GOAL_OPTIONS.map((o) => o.value);

const budgetString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? String(Math.floor(v)) : v.trim()))
  .refine((s) => /^\d+$/.test(s), 'budget must be numeric string');

export const campaignPresetPatchSchema = z.object({
  name: z.string().max(120).optional(),
  objective: z.enum(CAMPAIGN_OBJECTIVE_OPTIONS).optional(),
  status: z.enum(CAMPAIGN_STATUS_OPTIONS).optional(),
  spendCap: budgetString.nullable().optional(),
  dailyBudget: budgetString.nullable().optional(),
  lifetimeBudget: budgetString.nullable().optional(),
  bidStrategy: z.enum(BID_STRATEGY_OPTIONS).nullable().optional(),
  specialAdCategories: z.array(z.enum(SPECIAL_AD_CATEGORY_OPTIONS)).optional(),
});

export const adsetPresetPatchSchema = z.object({
  name: z.string().max(120).optional(),
  dailyBudget: budgetString.nullable().optional(),
  lifetimeBudget: budgetString.nullable().optional(),
  scheduleDuration: z.enum(SCHEDULE_DURATION_OPTIONS).nullable().optional(),
  scheduleCustomEnd: z.string().nullable().optional(),
  billingEvent: z.enum(billingEvents as [string, ...string[]]).optional(),
  optimizationGoal: z.enum(optimizationGoals as [string, ...string[]]).optional(),
  destinationType: z.enum(DESTINATION_TYPE_OPTIONS).nullable().optional(),
  bidStrategy: z.enum(BID_STRATEGY_OPTIONS).nullable().optional(),
  bidAmount: budgetString.nullable().optional(),
  pacingType: z.enum(PACING_TYPE_OPTIONS).nullable().optional(),
  promotedObject: z.record(z.unknown()).optional(),
  attributionSpec: z.array(z.unknown()).optional(),
  targeting: z.record(z.unknown()).optional(),
  bidConstraints: z.record(z.unknown()).optional(),
});

export const presetBuilderResponseSchema = z.object({
  campaign: campaignPresetPatchSchema.optional(),
  adset: adsetPresetPatchSchema.optional(),
  explanation: z.string(),
});

export const presetChatResponseSchema = presetBuilderResponseSchema.extend({
  reply: z.string(),
});

export const creativeSuggestResponseSchema = z.object({
  headline: z.string().min(1).max(500),
  primaryText: z.string().min(1).max(2000),
  description: z.string().max(500).optional(),
  ctaType: z.enum(CTA_OPTIONS),
  landingUrl: z.string().url().optional(),
  rationale: z.string(),
});

export const creativeRefinePatchSchema = z.object({
  reply: z.string(),
  headline: z.string().min(1).max(500).optional(),
  primaryText: z.string().min(1).max(2000).optional(),
  description: z.string().max(500).optional(),
  ctaType: z.enum(CTA_OPTIONS).optional(),
  landingUrl: z.string().url().optional(),
  rationale: z.string().optional(),
});

export type CampaignPresetPatch = z.infer<typeof campaignPresetPatchSchema>;
export type AdsetPresetPatch = z.infer<typeof adsetPresetPatchSchema>;
export type PresetBuilderResponse = z.infer<typeof presetBuilderResponseSchema>;
export type PresetChatResponse = z.infer<typeof presetChatResponseSchema>;
export type CreativeSuggestResponse = z.infer<typeof creativeSuggestResponseSchema>;
export type CreativeRefineResponse = z.infer<typeof creativeRefinePatchSchema>;
