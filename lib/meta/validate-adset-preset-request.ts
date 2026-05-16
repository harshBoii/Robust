import {
  coerceAdsetPresetMetaFields,
  validateAdsetPresetMeta,
} from '@/lib/meta/adset-preset-meta';
import { prisma } from '@/lib/prisma';

type AdsetPresetBody = {
  billingEvent?: unknown;
  optimizationGoal?: unknown;
  promotedObject?: unknown;
  bidStrategy?: unknown;
  bidAmount?: unknown;
  bidConstraints?: unknown;
  pinnedCampaignId?: unknown;
};

export async function validateAdsetPresetRequest(
  companyId: string,
  body: AdsetPresetBody,
): Promise<{ ok: true; fields: ReturnType<typeof coerceAdsetPresetMetaFields> } | { ok: false; error: string }> {
  const fields = coerceAdsetPresetMetaFields(body);

  let campaignObjective: string | null = 'OUTCOME_SALES';
  const pinnedCampaignId =
    typeof body.pinnedCampaignId === 'string' ? body.pinnedCampaignId.trim() : '';
  if (pinnedCampaignId) {
    const campaign = await prisma.metaCampaign.findFirst({
      where: {
        id: pinnedCampaignId,
        metaIntegration: { companyId },
      },
      select: { objective: true },
    });
    campaignObjective = campaign?.objective ?? null;
  }

  const bidStrategy = typeof body.bidStrategy === 'string' ? body.bidStrategy : null;
  const bidAmount =
    typeof body.bidAmount === 'number'
      ? body.bidAmount
      : typeof body.bidAmount === 'string'
        ? body.bidAmount
        : null;
  const result = validateAdsetPresetMeta({
    ...fields,
    bidStrategy,
    bidAmount,
    bidConstraints: body.bidConstraints,
    campaignObjective,
  });

  if (!result.ok) return result;
  return { ok: true, fields };
}
