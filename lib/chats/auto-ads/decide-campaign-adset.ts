import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';
import { PRESET_BUILD_MODEL } from '@/lib/assistant/models';
import { isCampaignObjectiveAllowed } from '@/lib/chats/campaign-objective-rules';
import { normalizeObjective } from '@/lib/meta/normalize-objective';
import type { MetaAdsAutoConfigData } from '@/lib/meta-ads-auto/config';

const staticBriefSchema = z.object({
  prompt: z.string().min(10),
  variantCount: z.number().int().min(1).max(4).default(2),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).default('1:1'),
  campaignTheme: z.string().optional(),
});

export type StaticBrief = z.infer<typeof staticBriefSchema>;

export async function decideStaticBrief(input: {
  userText: string;
  brandDnaBlock?: string | null;
  brandName?: string | null;
}): Promise<StaticBrief> {
  const system = `You plan Meta ad static image generation. Return JSON only with keys: prompt, variantCount (1-4), aspectRatio (1:1|16:9|9:16), campaignTheme (optional short label).`;

  const user = [
    `User request: ${input.userText}`,
    input.brandName ? `Brand: ${input.brandName}` : null,
    input.brandDnaBlock ? `Brand DNA:\n${input.brandDnaBlock}` : null,
    'Write a detailed image generation prompt for a professional Meta ad static. No text overlays in the image unless essential.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await completeJsonChat({ model: PRESET_BUILD_MODEL, system, user });
  const parsed = staticBriefSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return {
      prompt: `Professional Meta ad creative for: ${input.userText}. Brand-aligned, high quality product campaign visual.`,
      variantCount: 2,
      aspectRatio: '1:1',
      campaignTheme: input.userText.slice(0, 80),
    };
  }
  return parsed.data;
}

const campaignAdsetDecisionSchema = z.object({
  campaignAction: z.enum(['use_existing', 'create_new']),
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  objective: z.string().optional(),
  adsetAction: z.enum(['use_existing', 'create_new']),
  adsetId: z.string().optional(),
  adsetName: z.string().optional(),
  dailyBudget: z.number().int().positive().optional(),
  optimizationGoal: z.string().optional(),
  rationale: z.string(),
});

export type CampaignAdsetDecision = z.infer<typeof campaignAdsetDecisionSchema>;

export type CampaignOption = { id: string; name: string; objective: string };
export type AdsetOption = {
  id: string;
  name: string;
  campaignId: string;
  optimizationGoal?: string | null;
  billingEvent?: string | null;
};

export async function decideCampaignAdset(input: {
  userText: string;
  campaigns: CampaignOption[];
  adsets: AdsetOption[];
  hasPixel: boolean;
  pixelId?: string | null;
  config: MetaAdsAutoConfigData;
  intentNotes?: string;
  /** When adding to an existing campaign with ad sets — Meta lowest-cost rule */
  campaignAdSetConvention?: string | null;
}): Promise<CampaignAdsetDecision> {
  const allowedObjectives = [
    'OUTCOME_TRAFFIC',
    'OUTCOME_SALES',
    'OUTCOME_LEADS',
    'OUTCOME_ENGAGEMENT',
    'OUTCOME_AWARENESS',
  ].filter((o) => isCampaignObjectiveAllowed(o, input.hasPixel));

  const system = `You decide Meta campaign and ad set for an automated ad pipeline. Return JSON only.

Rules:
- Prefer use_existing when a campaign/adset name clearly matches the user's request (fuzzy match on theme/occasion).
- create_new only when no good match exists.
- objective must be one of: ${allowedObjectives.join(', ')}
- dailyBudget in smallest currency unit (e.g. paise for INR, cents for USD). Default ${input.config.defaultDailyBudget ?? 2000} if user didn't specify.
- campaignId/adsetId must be from the provided lists when use_existing.
- If no pixel, never pick OUTCOME_SALES or OUTCOME_LEADS.
- META RULE: On lowest-cost campaigns, every ad set must share the same optimizationGoal and billingEvent. When create_new on a campaign that already has ad sets, you MUST set optimizationGoal/billingEvent to match siblings (see convention block). Prefer use_existing ad set when it fits the request.`;

  const user = [
    `User request: ${input.userText}`,
    input.intentNotes ? `Notes: ${input.intentNotes}` : null,
    `Has pixel: ${input.hasPixel}${input.pixelId ? ` (${input.pixelId})` : ''}`,
    `Permissions: newCampaign=${input.config.allowNewCampaign}, newAdset=${input.config.allowNewAdset}`,
    `Default objective: ${input.config.defaultObjective ?? 'OUTCOME_TRAFFIC'}`,
    `Campaigns:\n${input.campaigns.map((c) => `- ${c.id}: ${c.name} (${c.objective})`).join('\n') || '(none)'}`,
    `Ad sets:\n${input.adsets.map((a) => `- ${a.id}: ${a.name}${a.optimizationGoal ? ` [opt=${a.optimizationGoal}]` : ''}`).join('\n') || '(none)'}`,
    input.campaignAdSetConvention ? `Campaign ad set convention:\n${input.campaignAdSetConvention}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await completeJsonChat({ model: PRESET_BUILD_MODEL, system, user });
  const parsed = campaignAdsetDecisionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return {
      campaignAction: input.campaigns.length ? 'use_existing' : 'create_new',
      campaignId: input.campaigns[0]?.id,
      campaignName: input.userText.slice(0, 60),
      objective: normalizeObjective(input.config.defaultObjective ?? 'OUTCOME_TRAFFIC'),
      adsetAction: 'create_new',
      adsetName: `${input.userText.slice(0, 40)} — Ad set`,
      dailyBudget: input.config.defaultDailyBudget ?? 2000,
      rationale: 'Fallback decision',
    };
  }
  const data = parsed.data;
  // Normalise any legacy objective the LLM may have output (e.g. CONVERSIONS → OUTCOME_SALES)
  if (data.objective) {
    data.objective = normalizeObjective(data.objective);
  }
  return data;
}

export function validateCampaignAdsetDecision(
  decision: CampaignAdsetDecision,
  campaigns: CampaignOption[],
  adsets: AdsetOption[],
  hasPixel: boolean,
): CampaignAdsetDecision {
  const campaignIds = new Set(campaigns.map((c) => c.id));
  const adsetIds = new Set(adsets.map((a) => a.id));

  let d = { ...decision };

  if (d.campaignAction === 'use_existing') {
    if (!d.campaignId || !campaignIds.has(d.campaignId)) {
      const match = campaigns.find((c) =>
        c.name.toLowerCase().includes((d.campaignName ?? '').toLowerCase().slice(0, 20)),
      );
      if (match) {
        d.campaignId = match.id;
      } else if (campaigns[0]) {
        d.campaignId = campaigns[0].id;
      } else {
        d.campaignAction = 'create_new';
      }
    }
  }

  if (d.adsetAction === 'use_existing') {
    if (!d.adsetId || !adsetIds.has(d.adsetId)) {
      const pool = d.campaignId
        ? adsets.filter((a) => a.campaignId === d.campaignId)
        : adsets;
      if (pool[0]) d.adsetId = pool[0].id;
      else d.adsetAction = 'create_new';
    }
  }

  const rawObjective = d.objective ?? 'OUTCOME_TRAFFIC';
  const objective = normalizeObjective(rawObjective);
  if (!isCampaignObjectiveAllowed(objective, hasPixel)) {
    d.objective = 'OUTCOME_TRAFFIC';
  } else {
    d.objective = objective;
  }

  return d;
}
