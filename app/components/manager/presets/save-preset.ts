import { readApiJson } from '@/lib/api/read-json';

import { buildAdsetPresetBody, buildCampaignPresetBody, validateCampaignPresetDraft } from './payload';
import type { AdsetPreset, CampaignPreset, MetaCampaignOption } from './types';

async function apiJson<T>(res: Response): Promise<T> {
  return readApiJson<T>(res);
}

export async function persistCampaignPresetDraft(
  presetId: string,
  draft: CampaignPreset,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const err = validateCampaignPresetDraft(draft);
  if (err) return { ok: false, error: err };

  const body = buildCampaignPresetBody(draft);
  await apiJson(
    await fetch(`/api/presets/campaign/${presetId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { ok: true };
}

export async function persistAdsetPresetDraft(
  presetId: string,
  draft: AdsetPreset,
  options: { advancedTargetingJson?: string; metaCampaigns?: MetaCampaignOption[] } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const built = buildAdsetPresetBody(draft, options);
  if (!built.ok) return built;

  await apiJson(
    await fetch(`/api/presets/adset/${presetId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(built.body),
    }),
  );
  return { ok: true };
}
