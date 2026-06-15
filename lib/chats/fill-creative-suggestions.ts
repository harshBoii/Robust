import 'server-only';

import type { GroupModel } from '@/app/components/createAd/types';
import { buildCreativeApplyPatch } from '@/lib/assistant/merge-preset-patch';
import { creativeSuggestForAsset } from '@/lib/assistant/creative-suggest-for-asset';
import { prisma } from '@/lib/prisma';

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

  let fallbackUrl = input.fallbackLandingUrl?.trim() || '';
  if (!fallbackUrl) {
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { website: true },
    });
    fallbackUrl = company?.website?.trim() || 'https://example.com';
  }

  const nextGroups = input.groups.map((g) => ({ ...g, creative: { ...g.creative } }));

  for (const g of nextGroups.filter((x) => x.included)) {
    const assetId = g.assetIds[0];
    if (!assetId) continue;

    const suggestion = await creativeSuggestForAsset({
      companyId: input.companyId,
      assetId,
      adType,
      tone,
      groupLabel: g.label,
    });

    const patch = buildCreativeApplyPatch(
      {
        headline: suggestion.headline,
        primaryText: suggestion.primaryText,
        description: suggestion.description,
        ctaType: suggestion.ctaType,
        landingUrl: suggestion.landingUrl?.trim() || fallbackUrl,
      },
      [],
    );

    g.creative = {
      ...g.creative,
      headline: patch.headline ?? g.creative.headline,
      primaryText: patch.primaryText ?? g.creative.primaryText,
      description: patch.description ?? g.creative.description ?? '',
      landingUrl: patch.landingUrl ?? g.creative.landingUrl,
      ctaType: patch.ctaType ?? g.creative.ctaType,
      pixelId,
    };
  }

  return nextGroups;
}
