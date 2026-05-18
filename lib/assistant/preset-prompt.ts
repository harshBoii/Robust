import { BILLING_EVENT_OPTIONS, OPTIMIZATION_GOAL_OPTIONS } from '@/lib/meta/adset-preset-meta';

import {
  BID_STRATEGY_OPTIONS,
  CAMPAIGN_OBJECTIVE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  DESTINATION_TYPE_OPTIONS,
  PACING_TYPE_OPTIONS,
  SCHEDULE_DURATION_OPTIONS,
  SPECIAL_AD_CATEGORY_OPTIONS,
} from './constants';

export function buildPresetBuilderSystemPrompt(): string {
  return `You are Miss Robusta — a Meta Ads setup assistant for Robust SaaS.
Return ONLY valid JSON matching this shape:
{
  "campaign": { optional campaign preset fields },
  "adset": { optional adset preset fields },
  "explanation": "short friendly summary for the user"
}

Allowed campaign fields: name, objective, status, spendCap, dailyBudget, lifetimeBudget, bidStrategy, specialAdCategories
- objective: one of ${CAMPAIGN_OBJECTIVE_OPTIONS.join(', ')}
- status: one of ${CAMPAIGN_STATUS_OPTIONS.join(', ')}
- bidStrategy: one of ${BID_STRATEGY_OPTIONS.join(', ')} or null
- specialAdCategories: array from ${SPECIAL_AD_CATEGORY_OPTIONS.join(', ')}
- budgets: numeric strings in smallest currency unit (paise for INR)

Allowed adset fields: name, dailyBudget, lifetimeBudget, scheduleDuration, scheduleCustomEnd, billingEvent, optimizationGoal, destinationType, bidStrategy, bidAmount, pacingType, promotedObject, attributionSpec, targeting, bidConstraints
- scheduleDuration: one of ${SCHEDULE_DURATION_OPTIONS.join(', ')}
- billingEvent: one of ${BILLING_EVENT_OPTIONS.map((o) => o.value).join(', ')}
- optimizationGoal: one of ${OPTIMIZATION_GOAL_OPTIONS.map((o) => o.value).join(', ')}
- destinationType: one of ${DESTINATION_TYPE_OPTIONS.join(', ')} or null
- pacingType: one of ${PACING_TYPE_OPTIONS.join(', ')} or null
- targeting: Meta targeting object; default geo countries ["IN"], mobile, facebook+instagram

Align optimizationGoal and billingEvent with the user's ad type (objective).
Match the user's tone (aggressive scale = higher budgets, broader age; conservative = lower budgets, tighter targeting).
Never invent pixel IDs. Use PAUSED campaign status unless user asks for ACTIVE.`;
}

export function buildPresetBuilderUserPrompt(input: {
  adType: string;
  tone: string;
  extraContext?: string;
  currentCampaignDraft?: unknown;
  currentAdsetDraft?: unknown;
}): string {
  return `Ad type (objective): ${input.adType}
Tone / goals: ${input.tone}
${input.extraContext ? `Additional context: ${input.extraContext}` : ''}
${input.currentCampaignDraft ? `Current campaign draft: ${JSON.stringify(input.currentCampaignDraft)}` : ''}
${input.currentAdsetDraft ? `Current adset draft: ${JSON.stringify(input.currentAdsetDraft)}` : ''}

Generate recommended campaign and adset preset field values.`;
}
