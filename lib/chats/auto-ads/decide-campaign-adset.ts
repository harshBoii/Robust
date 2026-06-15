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
  campaignAction: z.enum(['use_existing', 'create_new', 'use_preset']),
  campaignId: z.string().optional(),
  campaignPresetId: z.string().optional(),
  campaignName: z.string().optional(),
  objective: z.string().optional(),
  adsetAction: z.enum(['use_existing', 'create_new', 'use_preset']),
  adsetId: z.string().optional(),
  adsetPresetId: z.string().optional(),
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

export type PresetComboOption = {
  id: string;
  campaignPresetId: string;
  campaignPresetName: string;
  adsetPresetId: string;
  adsetPresetName: string;
  objective: string;
  source: string;
};

export async function decideCampaignAdset(input: {
  userText: string;
  campaigns: CampaignOption[];
  adsets: AdsetOption[];
  presetCombos?: PresetComboOption[];
  hasPixel: boolean;
  pixelId?: string | null;
  config: MetaAdsAutoConfigData;
  intentNotes?: string;
  /** When adding to an existing campaign with ad sets — Meta lowest-cost rule */
  campaignAdSetConvention?: string | null;
  /** When true, only decide ad set (campaign already resolved). */
  adsetPhaseOnly?: boolean;
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
- STRONGLY prefer use_preset when a saved preset combo matches the request — these are tried-and-tested campaign + ad set pairs.
- use_preset requires campaignPresetId and adsetPresetId from the preset combo list.
- Prefer use_existing when a live campaign/adset name clearly matches the user's request (fuzzy match on theme/occasion).
- create_new only when no preset combo or live campaign/ad set fits.
- objective must be one of: ${allowedObjectives.join(', ')}
- dailyBudget in smallest currency unit (e.g. paise for INR, cents for USD). Default ${input.config.defaultDailyBudget ?? 2000} if user didn't specify.
- campaignId/adsetId must be from the provided lists when use_existing.
- campaignPresetId/adsetPresetId must be from the preset combo list when use_preset.
- If no pixel, never pick OUTCOME_SALES or OUTCOME_LEADS.
- META RULE: On lowest-cost campaigns, every ad set must share the same optimizationGoal and billingEvent. When create_new on a campaign that already has ad sets, you MUST set optimizationGoal/billingEvent to match siblings (see convention block). Prefer use_existing ad set when it fits the request.
${input.adsetPhaseOnly ? '- Campaign is already chosen — set campaignAction to use_existing and only decide adsetAction.' : ''}`;

  const user = [
    `User request: ${input.userText}`,
    input.intentNotes ? `Notes: ${input.intentNotes}` : null,
    `Has pixel: ${input.hasPixel}${input.pixelId ? ` (${input.pixelId})` : ''}`,
    `Permissions: newCampaign=${input.config.allowNewCampaign}, newAdset=${input.config.allowNewAdset}`,
    `Default objective: ${input.config.defaultObjective ?? 'OUTCOME_TRAFFIC'}`,
    `Saved preset combos (prefer these):\n${input.presetCombos?.map((c) => `- ${c.id}: "${c.campaignPresetName}" + "${c.adsetPresetName}" (${c.objective}, ${c.source})`).join('\n') || '(none)'}`,
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
  presetCombos: PresetComboOption[] = [],
): CampaignAdsetDecision {
  const campaignIds = new Set(campaigns.map((c) => c.id));
  const adsetIds = new Set(adsets.map((a) => a.id));
  const comboByCampaignPreset = new Map(
    presetCombos.map((c) => [c.campaignPresetId, c]),
  );
  const comboByAdsetPreset = new Map(presetCombos.map((c) => [c.adsetPresetId, c]));

  let d = { ...decision };

  if (d.campaignAction === 'use_preset') {
    if (!d.campaignPresetId || !comboByCampaignPreset.has(d.campaignPresetId)) {
      const first = presetCombos[0];
      if (first) {
        d.campaignPresetId = first.campaignPresetId;
        if (!d.adsetPresetId) d.adsetPresetId = first.adsetPresetId;
      } else {
        d.campaignAction = campaigns.length ? 'use_existing' : 'create_new';
      }
    }
  }

  if (d.adsetAction === 'use_preset') {
    if (!d.adsetPresetId || !comboByAdsetPreset.has(d.adsetPresetId)) {
      const fromCampaign =
        d.campaignPresetId ? comboByCampaignPreset.get(d.campaignPresetId) : presetCombos[0];
      if (fromCampaign) {
        d.adsetPresetId = fromCampaign.adsetPresetId;
      } else if (presetCombos[0]) {
        d.adsetPresetId = presetCombos[0].adsetPresetId;
      } else {
        d.adsetAction = 'create_new';
      }
    }
  }

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
