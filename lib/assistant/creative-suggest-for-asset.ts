import 'server-only';

import { AssetType } from '@/app/generated/prisma/enums';
import { buildStreamThumbnailUrls } from '@/lib/assistant/build-stream-thumbnails';
import {
  buildCreativeSuggestSystemPrompt,
  buildCreativeSuggestUserText,
} from '@/lib/assistant/creative-prompt';
import {
  assertCreativeSuggestAllowed,
  CreativeRateLimitError,
} from '@/lib/assistant/creative-rate-limit';
import { completeVisionJsonChat } from '@/lib/assistant/openai-json';
import { creativeSuggestResponseSchema } from '@/lib/assistant/schemas';
import {
  validateCreativePartial,
  validateFullOrPartial,
} from '@/lib/assistant/validate-with-retry';
import {
  isValidMetaLandingUrl,
  normalizeMetaLandingUrl,
} from '@/lib/assistant/landing-url-validation';
import { prisma } from '@/lib/prisma';

export type CreativeSuggestForAssetInput = {
  companyId: string;
  assetId: string;
  adType?: string;
  tone?: string;
  groupLabel?: string;
};

export type CreativeSuggestResult = {
  headline: string;
  primaryText: string;
  description?: string;
  ctaType: string;
  landingUrl?: string;
  rationale?: string;
  partial: boolean;
};

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function sanitizeLandingUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim() || !isValidMetaLandingUrl(raw)) return undefined;
  return normalizeMetaLandingUrl(raw);
}

export async function creativeSuggestForAsset(
  input: CreativeSuggestForAssetInput,
): Promise<CreativeSuggestResult> {
  const { companyId, assetId } = input;
  const adType = input.adType?.trim() || 'OUTCOME_TRAFFIC';
  const tone = input.tone?.trim() || 'general';
  const groupLabel = input.groupLabel?.trim();

  await assertCreativeSuggestAllowed(companyId);

  const [asset, company, primaryOffering] = await Promise.all([
    prisma.asset.findFirst({
      where: { id: assetId, companyId },
      select: {
        id: true,
        assetType: true,
        streamId: true,
        duration: true,
        thumbnailUrl: true,
      },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { website: true },
    }),
    prisma.offering.findFirst({
      where: { companyId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      select: { url: true },
    }),
  ]);

  if (!asset) {
    throw new Error('Asset not found');
  }

  const brandLandingUrl =
    [primaryOffering?.url, company?.website].find((u) => isValidMetaLandingUrl(u)) ?? undefined;

  const system = buildCreativeSuggestSystemPrompt();
  const userText = buildCreativeSuggestUserText({
    adType,
    tone,
    groupLabel,
    brandLandingUrl,
  });

  let imageUrls: string[] = [];
  if (asset.assetType === AssetType.VIDEO) {
    if (!asset.streamId || !asset.duration) {
      throw new Error('Video is still processing. Try again in a minute.');
    }
    imageUrls = buildStreamThumbnailUrls(asset.streamId, asset.duration);
  } else if (asset.thumbnailUrl) {
    imageUrls = [asset.thumbnailUrl];
  } else {
    throw new Error('No visual available for this asset');
  }

  let lastZodError = '';

  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt++) {
    const content = await completeVisionJsonChat({
      system,
      userText:
        attempt === 1
          ? userText
          : `${userText}\n\nPrevious JSON failed validation:\n${lastZodError}\nReturn valid JSON only.`,
      imageUrls,
    });

    const raw = parseJson(content);
    const result = validateFullOrPartial(raw, creativeSuggestResponseSchema, attempt);
    if (!result.data && attempt === 1) {
      const fail = creativeSuggestResponseSchema.safeParse(raw);
      if (!fail.success) lastZodError = fail.error.message;
    }

    if (result.data && !result.partial) {
      return {
        headline: result.data.headline,
        primaryText: result.data.primaryText,
        description: result.data.description,
        ctaType: result.data.ctaType,
        landingUrl: sanitizeLandingUrl(result.data.landingUrl) ?? sanitizeLandingUrl(brandLandingUrl),
        rationale: result.data.rationale,
        partial: false,
      };
    }

    if (attempt === 2) {
      const part = validateCreativePartial(raw);
      if (part.data) {
        return {
          headline: part.data.headline ?? '',
          primaryText: part.data.primaryText ?? '',
          description: part.data.description,
          ctaType: part.data.ctaType ?? 'LEARN_MORE',
          landingUrl: sanitizeLandingUrl(part.data.landingUrl) ?? sanitizeLandingUrl(brandLandingUrl),
          rationale:
            typeof (raw as Record<string, unknown>)?.rationale === 'string'
              ? ((raw as Record<string, unknown>).rationale as string)
              : 'Partial suggestions applied.',
          partial: true,
        };
      }
    }
  }

  throw new Error('Failed to generate creative suggestions');
}

export { CreativeRateLimitError };
