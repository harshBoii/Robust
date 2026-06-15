import 'server-only';

import { creativeSuggestForAsset } from '@/lib/assistant/creative-suggest-for-asset';
import {
  isValidMetaLandingUrl,
  normalizeMetaLandingUrl,
  resolveCreativeLandingUrl,
} from '@/lib/assistant/landing-url-validation';
import { prisma } from '@/lib/prisma';

const PLACEHOLDER_COPY = new Set(['—', '-', 'robust ad', 'untitled ad', 'untitled']);

function normalizeCopyToken(value: string): string {
  return value.trim().toLowerCase();
}

/** True when copy is empty or looks like a filename/title placeholder, not real ad copy. */
export function isPlaceholderCopy(
  value: string | null | undefined,
  assetTitle?: string | null,
): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  const token = normalizeCopyToken(trimmed);
  if (PLACEHOLDER_COPY.has(token)) return true;
  if (assetTitle && token === normalizeCopyToken(assetTitle)) return true;
  return false;
}

export type ResolveCreativeCopyInput = {
  companyId: string;
  assetId: string;
  adType?: string | null;
  tone?: string | null;
  groupLabel?: string | null;
  headline?: string | null;
  primaryText?: string | null;
  description?: string | null;
  landingUrl?: string | null;
  ctaType?: string | null;
};

export type ResolvedCreativeCopy = {
  headline: string;
  primaryText: string;
  description: string | null;
  landingUrl: string;
  ctaType: string;
  aiGenerated: boolean;
};

/**
 * Same copy path as chat "Write copy with AI" (creativeSuggestForAsset).
 * Keeps explicit user copy; fills gaps with AI suggestions from the asset visuals.
 */
export async function resolveCreativeCopyForAsset(
  input: ResolveCreativeCopyInput,
): Promise<ResolvedCreativeCopy> {
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, companyId: input.companyId },
    select: { title: true },
  });
  const assetTitle = asset?.title ?? null;

  const needsHeadline = isPlaceholderCopy(input.headline, assetTitle);
  const needsPrimary = isPlaceholderCopy(input.primaryText, assetTitle);
  const needsCta = !input.ctaType?.trim();
  const needsLanding = !isValidMetaLandingUrl(input.landingUrl);
  const needsAi = needsHeadline || needsPrimary || needsCta || needsLanding;

  let suggestion: Awaited<ReturnType<typeof creativeSuggestForAsset>> | null = null;
  if (needsAi) {
    suggestion = await creativeSuggestForAsset({
      companyId: input.companyId,
      assetId: input.assetId,
      adType: input.adType ?? undefined,
      tone: input.tone ?? undefined,
      groupLabel: input.groupLabel ?? undefined,
    });
  }

  const [company, primaryOffering] = await Promise.all([
    prisma.company.findUnique({
      where: { id: input.companyId },
      select: { website: true },
    }),
    prisma.offering.findFirst({
      where: { companyId: input.companyId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      select: { url: true },
    }),
  ]);

  const suggestedUrl = suggestion?.landingUrl?.trim();
  const landingUrl = resolveCreativeLandingUrl(
    [
      input.landingUrl,
      suggestedUrl && isValidMetaLandingUrl(suggestedUrl)
        ? normalizeMetaLandingUrl(suggestedUrl)
        : null,
      primaryOffering?.url,
      company?.website,
    ],
    { fallback: 'https://example.com' },
  );

  const headline = needsHeadline
    ? suggestion?.headline?.trim() || assetTitle || 'Robust Ad'
    : input.headline!.trim();

  const primaryText = needsPrimary
    ? suggestion?.primaryText?.trim() || headline
    : input.primaryText!.trim();

  const description = input.description?.trim()
    ? input.description.trim()
    : suggestion?.description?.trim() || null;

  const ctaType = input.ctaType?.trim() || suggestion?.ctaType || 'LEARN_MORE';

  return {
    headline,
    primaryText,
    description,
    landingUrl,
    ctaType,
    aiGenerated: Boolean(suggestion),
  };
}
