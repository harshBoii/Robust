import {
  BILLING_EVENT_OPTIONS,
  OPTIMIZATION_GOAL_OPTIONS,
} from '@/lib/meta/adset-preset-meta';
import { buildTargetingFieldDocumentation } from '@/lib/meta/targeting';

import {
  BID_STRATEGY_OPTIONS,
  CAMPAIGN_OBJECTIVE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  DESTINATION_TYPE_OPTIONS,
  PACING_TYPE_OPTIONS,
  SCHEDULE_DURATION_OPTIONS,
  SPECIAL_AD_CATEGORY_OPTIONS,
} from './constants';

const campaignFieldsBlock = `Allowed campaign fields: name, objective, status, spendCap, dailyBudget, lifetimeBudget, bidStrategy, specialAdCategories, isAdsetBudgetSharingEnabled
- objective: one of ${CAMPAIGN_OBJECTIVE_OPTIONS.join(', ')}
- status: one of ${CAMPAIGN_STATUS_OPTIONS.join(', ')}
- bidStrategy: one of ${BID_STRATEGY_OPTIONS.join(', ')} or null
- specialAdCategories: array from ${SPECIAL_AD_CATEGORY_OPTIONS.join(', ')}
- isAdsetBudgetSharingEnabled: boolean — required when dailyBudget and lifetimeBudget are both empty (ad-set budgets). true lets ad sets share ~20% budget; false disables. Omit/null when campaign has a budget.
- budgets: numeric strings in smallest currency unit (paise for INR)`;

const adsetFieldsBlock = `Allowed adset fields: name, dailyBudget, lifetimeBudget, scheduleDuration, scheduleCustomEnd, billingEvent, optimizationGoal, destinationType, bidStrategy, bidAmount, pacingType, promotedObject, attributionSpec, targeting, bidConstraints
- scheduleDuration: one of ${SCHEDULE_DURATION_OPTIONS.join(', ')}
- billingEvent: one of ${BILLING_EVENT_OPTIONS.map((o) => o.value).join(', ')}
- optimizationGoal: one of ${OPTIMIZATION_GOAL_OPTIONS.map((o) => o.value).join(', ')}
- destinationType: one of ${DESTINATION_TYPE_OPTIONS.join(', ')} or null
- pacingType: one of ${PACING_TYPE_OPTIONS.join(', ')} or null
- targeting: Meta Marketing API targeting object. You may read and write ALL of these subfields:
${buildTargetingFieldDocumentation().replace(/^/gm, '  ')}
- Align optimizationGoal and billingEvent with the parent campaign objective and budget model (CBO vs ABO).
- Every adset.targeting you output MUST include non-empty device_platforms, publisher_platforms, facebook_positions, and instagram_positions.`;

export function buildPresetChatSystemPrompt(target: 'campaign' | 'adset'): string {
  const shared = `You are Miss Robusta — a Meta Ads setup assistant for Robust SaaS.
Return ONLY valid JSON. Never invent pixel IDs unless the user explicitly provides one. Use PAUSED campaign status unless user asks for ACTIVE.
Make sure fields are valid and combinations match Meta Marketing API rules.
When fixing Meta API errors: change only the fields the error mentions. For pixel_id / promoted_object errors, fix promotedObject and optimizationGoal — never change targeting_automation or Advantage audience.`;

  if (target === 'campaign') {
    return `${shared}

You are editing the **campaign preset only**.

Return this shape (do NOT include an "adset" key):
{
  "campaign": { campaign preset fields },
  "reply": "short conversational message for the user (1-3 sentences)",
  "explanation": "internal summary"
}

${campaignFieldsBlock}

On follow-up messages, return ONLY campaign fields the user asked to change (delta patches inside "campaign").`;
  }

  return `${shared}

You are editing the **ad set preset only**.

Return this shape (do NOT include a "campaign" key):
{
  "adset": { adset preset fields },
  "reply": "short conversational message for the user (1-3 sentences)",
  "explanation": "internal summary"
}

${adsetFieldsBlock}

promotedObject rules:
- Shape: { "conversion_tracking_enabled": true|false, "pixel_id": "...", "custom_event_type": "PURCHASE" }
- If pixel_id is missing and no pixel exists on the account: set conversion_tracking_enabled to false AND set optimizationGoal to LINK_CLICKS (or LANDING_PAGE_VIEWS for sales traffic). Do NOT omit promotedObject without adjusting optimizationGoal.
- If the user provides a pixel ID in chat, set pixel_id on promotedObject with conversion_tracking_enabled true.
- NEVER fix pixel or conversion errors by changing targeting, targeting_automation, or advantage_audience — only promotedObject, optimizationGoal, billingEvent, and bid fields.

The parent campaign JSON in the conversation is **read-only context**. Do not return campaign fields.
Use it to pick compatible billingEvent, optimizationGoal, bidStrategy, and budgets (if the campaign uses CBO, ad set budgets may be null).
On follow-up messages, return ONLY adset fields the user asked to change (delta patches inside "adset").`;
}

function pixelContextBlock(input: {
  hasPixel?: boolean;
  pixelId?: string | null;
}): string {
  if (input.hasPixel || input.pixelId?.trim()) {
    const id = input.pixelId?.trim();
    return id
      ? `Meta Pixel: user provided pixel_id ${id}. Sales and Leads objectives are allowed.`
      : 'Meta Pixel: user confirmed they have a pixel. Sales and Leads objectives are allowed.';
  }
  return `Meta Pixel: user has NO pixel. Do NOT set campaign objective to OUTCOME_SALES or OUTCOME_LEADS. Use OUTCOME_TRAFFIC (LINK_CLICKS or LANDING_PAGE_VIEWS), OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS, or OUTCOME_APP_PROMOTION only.`;
}

export function buildPresetChatMessagesForApi(input: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  presetTarget: 'campaign' | 'adset';
  adType?: string | null;
  tone?: string | null;
  currentCampaignDraft?: unknown;
  currentAdsetDraft?: unknown;
  hasPixel?: boolean;
  pixelId?: string | null;
}): { role: 'user' | 'assistant'; content: string }[] {
  const adTypeLine = input.adType?.trim()
    ? `Ad type (objective): ${input.adType}`
    : 'Ad type: infer from parent campaign draft objective if present.';
  const toneLine = input.tone?.trim()
    ? `Tone: ${input.tone}`
    : 'Tone: not specified — use sensible defaults from the request.';

  const campaignJson = JSON.stringify(input.currentCampaignDraft ?? {});
  const adsetJson = JSON.stringify(input.currentAdsetDraft ?? {});

  const pixelLine = pixelContextBlock(input);

  const contextNote =
    input.presetTarget === 'campaign'
      ? `Context — ${adTypeLine}
${toneLine}
${pixelLine}
Editing: CAMPAIGN preset only.
Current campaign draft: ${campaignJson}`
      : `Context — ${adTypeLine}
${toneLine}
${pixelLine}
Editing: AD SET preset only.
Parent campaign (read-only — align ad set fields with this): ${campaignJson}
Current adset draft: ${adsetJson}`;

  const history = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (history.length === 0) {
    return [
      {
        role: 'user' as const,
        content: `${contextNote}\n\nHelp fix or improve the preset based on the user's needs.`,
      },
    ];
  }

  const last = history[history.length - 1];
  if (last?.role === 'user') {
    return [
      ...history.slice(0, -1),
      { role: 'user' as const, content: `${contextNote}\n\nUser request: ${last.content}` },
    ];
  }

  return [...history, { role: 'user' as const, content: contextNote }];
}

export function resolvePresetChatAdType(
  explicit: string | null | undefined,
  campaignDraft: unknown,
): string {
  if (explicit?.trim()) return explicit.trim();
  if (
    campaignDraft &&
    typeof campaignDraft === 'object' &&
    typeof (campaignDraft as { objective?: unknown }).objective === 'string' &&
    (campaignDraft as { objective: string }).objective.trim()
  ) {
    return (campaignDraft as { objective: string }).objective.trim();
  }
  return 'OUTCOME_TRAFFIC';
}

export function resolvePresetChatTone(explicit: string | null | undefined): string {
  return explicit?.trim() || 'general';
}
