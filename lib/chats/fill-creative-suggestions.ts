import 'server-only';

import type { GroupModel } from '@/app/components/createAd/types';
import { resolveCreativeCopyForAsset } from '@/lib/assistant/resolve-creative-copy-for-asset';

/**
 * Same creative-fill path as the ADS chat subpath (CreativeBuildingWidget → creative.aiDone)
 * and Post to Meta: AI suggest per asset, apply patch to group creatives — no Meta upload yet.
 * Meta creatives are created later in processPublishJobs (publish.submit / pending publish).
 */
export async function fillGroupsWithCreativeSuggestions(input: {
  companyId: string;
  groups: GroupModel[];
  adType?: string | null;
  tone?: string | null;
  pixelId?: string | null;
  fallbackLandingUrl?: string | null;
}): Promise<GroupModel[]> {
  const adType = input.adType?.trim() || 'OUTCOME_TRAFFIC';
  const tone = input.tone?.trim() || 'general';
  const pixelId = input.pixelId?.trim() || '';

  const nextGroups = input.groups.map((g) => ({ ...g, creative: { ...g.creative } }));

  for (const g of nextGroups.filter((x) => x.included)) {
    const assetId = g.assetIds[0];
    if (!assetId) continue;

    const resolved = await resolveCreativeCopyForAsset({
      companyId: input.companyId,
      assetId,
      adType,
      tone,
      groupLabel: g.label,
      headline: g.creative.headline,
      primaryText: g.creative.primaryText,
      description: g.creative.description,
      landingUrl: g.creative.landingUrl || input.fallbackLandingUrl,
      ctaType: g.creative.ctaType,
    });

    g.creative = {
      ...g.creative,
      headline: resolved.headline,
      primaryText: resolved.primaryText,
      description: resolved.description ?? '',
      landingUrl: resolved.landingUrl,
      ctaType: resolved.ctaType,
      pixelId,
    };
  }

  return nextGroups;
}
