import 'server-only';

import {
  normalizeAdsetPreset,
  normalizeCampaignPreset,
} from '@/app/components/manager/presets/normalize';
import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { isCampaignObjectiveAllowed } from '@/lib/chats/campaign-objective-rules';
import { normalizeObjective } from '@/lib/meta/normalize-objective';
import { prisma } from '@/lib/prisma';

export type PresetCombo = {
  id: string;
  campaignPresetId: string;
  campaignPresetName: string;
  adsetPresetId: string;
  adsetPresetName: string;
  objective: string;
  /** Meta campaign DB id when combo is pinned to a live campaign */
  pinnedMetaCampaignId: string | null;
  /** How the combo was discovered */
  source: 'pinned' | 'historical' | 'default_pair';
  scoreBoost: number;
};

export type PresetComboPick = {
  combo: PresetCombo;
  campaignDraft: CampaignPreset;
  adsetDraft: AdsetPreset;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function scoreCombo(combo: PresetCombo, userText: string): number {
  let score = combo.scoreBoost;
  const tokens = tokenize(userText);
  const haystack = [
    combo.campaignPresetName,
    combo.adsetPresetName,
    combo.objective,
  ]
    .join(' ')
    .toLowerCase();

  for (const token of tokens) {
    if (haystack.includes(token)) score += 3;
  }
  return score;
}

/** Load tried-and-tested campaign + ad set preset pairs for a company. */
export async function loadPresetCombos(companyId: string): Promise<PresetCombo[]> {
  const [campaignPresets, adsetPresets, historical] = await Promise.all([
    prisma.campaignPreset.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    }),
    prisma.adsetPreset.findMany({
      where: { companyId },
      include: {
        pinnedCampaign: {
          select: {
            id: true,
            name: true,
            objective: true,
            campaignPresetId: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    }),
    prisma.metaAdSet.findMany({
      where: {
        metaIntegration: { companyId },
        adsetPresetId: { not: null },
        campaign: { campaignPresetId: { not: null } },
      },
      select: {
        adsetPresetId: true,
        adsetPreset: { select: { id: true, name: true } },
        campaign: {
          select: {
            id: true,
            campaignPresetId: true,
            objective: true,
            name: true,
            campaignPreset: { select: { id: true, name: true } },
          },
        },
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const campaignById = new Map(campaignPresets.map((p) => [p.id, p]));
  const combos = new Map<string, PresetCombo>();

  const addCombo = (input: Omit<PresetCombo, 'id'>) => {
    const key = `${input.campaignPresetId}::${input.adsetPresetId}`;
    const existing = combos.get(key);
    if (!existing || input.scoreBoost > existing.scoreBoost) {
      combos.set(key, { id: key, ...input });
    }
  };

  for (const adset of adsetPresets) {
    const pinned = adset.pinnedCampaign;
    if (!pinned?.campaignPresetId) continue;
    const campaignPreset = campaignById.get(pinned.campaignPresetId);
    if (!campaignPreset) continue;
    addCombo({
      campaignPresetId: campaignPreset.id,
      campaignPresetName: campaignPreset.name,
      adsetPresetId: adset.id,
      adsetPresetName: adset.name,
      objective: normalizeObjective(campaignPreset.objective ?? pinned.objective),
      pinnedMetaCampaignId: pinned.id,
      source: 'pinned',
      scoreBoost: 10 + (campaignPreset.isDefault ? 2 : 0) + (adset.isDefault ? 2 : 0),
    });
  }

  for (const row of historical) {
    const campaignPresetId = row.campaign?.campaignPresetId;
    const adsetPresetId = row.adsetPresetId;
    if (!campaignPresetId || !adsetPresetId) continue;
    const campaignPreset = campaignById.get(campaignPresetId);
    const adsetPreset = adsetPresets.find((a) => a.id === adsetPresetId);
    if (!campaignPreset || !adsetPreset) continue;
    addCombo({
      campaignPresetId,
      campaignPresetName: campaignPreset.name,
      adsetPresetId,
      adsetPresetName: adsetPreset.name,
      objective: normalizeObjective(campaignPreset.objective ?? row.campaign?.objective),
      pinnedMetaCampaignId: row.campaign?.id ?? null,
      source: 'historical',
      scoreBoost: 8,
    });
  }

  const defaultCampaign = campaignPresets.find((p) => p.isDefault);
  const defaultAdset = adsetPresets.find((p) => p.isDefault);
  if (defaultCampaign && defaultAdset) {
    addCombo({
      campaignPresetId: defaultCampaign.id,
      campaignPresetName: defaultCampaign.name,
      adsetPresetId: defaultAdset.id,
      adsetPresetName: defaultAdset.name,
      objective: normalizeObjective(defaultCampaign.objective),
      pinnedMetaCampaignId: defaultAdset.pinnedCampaignId,
      source: 'default_pair',
      scoreBoost: 5,
    });
  }

  return [...combos.values()].sort((a, b) => b.scoreBoost - a.scoreBoost);
}

export function formatPresetCombosForLlm(combos: PresetCombo[]): string {
  if (!combos.length) return '(no saved preset combos)';
  return combos
    .slice(0, 12)
    .map(
      (c) =>
        `- combo ${c.id}: campaign="${c.campaignPresetName}" + adset="${c.adsetPresetName}" (${c.objective}, source=${c.source})`,
    )
    .join('\n');
}

export async function loadPresetDrafts(
  companyId: string,
  campaignPresetId: string,
  adsetPresetId: string,
): Promise<PresetComboPick | null> {
  const [campaignRow, adsetRow] = await Promise.all([
    prisma.campaignPreset.findFirst({ where: { id: campaignPresetId, companyId } }),
    prisma.adsetPreset.findFirst({ where: { id: adsetPresetId, companyId } }),
  ]);
  if (!campaignRow || !adsetRow) return null;

  const campaignDraft = normalizeCampaignPreset(campaignRow);
  campaignDraft.objective = normalizeObjective(campaignDraft.objective);
  const adsetDraft = normalizeAdsetPreset(adsetRow);

  const combo: PresetCombo = {
    id: `${campaignPresetId}::${adsetPresetId}`,
    campaignPresetId,
    campaignPresetName: campaignRow.name,
    adsetPresetId,
    adsetPresetName: adsetRow.name,
    objective: campaignDraft.objective ?? 'OUTCOME_TRAFFIC',
    pinnedMetaCampaignId: adsetRow.pinnedCampaignId,
    source: 'pinned',
    scoreBoost: 0,
  };

  return { combo, campaignDraft, adsetDraft };
}

/** Pick the best preset combo for auto mode, or null when none exist. */
export function pickPresetCombo(
  combos: PresetCombo[],
  userText: string,
  hasPixel: boolean,
): PresetCombo | null {
  const allowed = combos.filter((c) =>
    isCampaignObjectiveAllowed(c.objective, hasPixel),
  );
  if (!allowed.length) return null;

  let best: PresetCombo | null = null;
  let bestScore = -1;
  for (const combo of allowed) {
    const score = scoreCombo(combo, userText);
    if (score > bestScore) {
      bestScore = score;
      best = combo;
    }
  }
  return best ?? allowed[0]!;
}

export function buildPresetFirstDecision(
  combo: PresetCombo,
  campaigns: { id: string; name: string }[],
  defaultDailyBudget?: number | null,
): {
  campaignAction: 'use_existing' | 'use_preset';
  campaignId?: string;
  campaignPresetId: string;
  adsetAction: 'use_preset';
  adsetPresetId: string;
  objective: string;
  dailyBudget?: number;
  rationale: string;
} {
  const existingCampaign = combo.pinnedMetaCampaignId
    ? campaigns.find((c) => c.id === combo.pinnedMetaCampaignId)
    : null;

  if (existingCampaign) {
    return {
      campaignAction: 'use_existing',
      campaignId: existingCampaign.id,
      campaignPresetId: combo.campaignPresetId,
      adsetAction: 'use_preset',
      adsetPresetId: combo.adsetPresetId,
      objective: combo.objective,
      dailyBudget: defaultDailyBudget ?? undefined,
      rationale: `Reusing campaign "${existingCampaign.name}" with preset ad set "${combo.adsetPresetName}".`,
    };
  }

  return {
    campaignAction: 'use_preset',
    campaignPresetId: combo.campaignPresetId,
    adsetAction: 'use_preset',
    adsetPresetId: combo.adsetPresetId,
    objective: combo.objective,
    dailyBudget: defaultDailyBudget ?? undefined,
    rationale: `Using saved preset combo "${combo.campaignPresetName}" + "${combo.adsetPresetName}".`,
  };
}
