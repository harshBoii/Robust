import 'server-only';

import { prisma } from '@/lib/prisma';

export type IntelligenceResultRow = {
  assetId: string;
  title: string;
  assetType: string;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  intelligenceStatus: string;
  adName: string | null;
  metaAdId: string | null;
  intelligence: {
    language: string | null;
    contentType: string | null;
    durationSeconds: number | null;
    theme: string | null;
    sentiment: string | null;
    intensityScore: number | null;
    spiritualElements: boolean;
    titlePrimary: string | null;
    shortSummary: string | null;
    longDescription: string | null;
    tags: string[];
    tone: string[];
    topics: string[];
    targetAudience: string[];
    bestPlatforms: string[];
    visualContext: string[];
    videoGenres: string[];
    missRobustaInsights: unknown;
    modelVersion: string | null;
    confidence: number | null;
    processedAt: string;
  } | null;
};

function adContextForAsset(
  assetId: string,
  creatives: Array<{
    assetId: string | null;
    ads: Array<{ metaAdId: string; name: string | null }>;
  }>,
): { adName: string | null; metaAdId: string | null } {
  const creative = creatives.find((c) => c.assetId === assetId);
  const ad = creative?.ads[0];
  return {
    adName: ad?.name ?? null,
    metaAdId: ad?.metaAdId ?? null,
  };
}

export async function getIntelligenceResultsForAssets(
  companyId: string,
  assetIds: string[],
): Promise<IntelligenceResultRow[]> {
  if (!assetIds.length) return [];

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, companyId },
    select: {
      id: true,
      title: true,
      assetType: true,
      thumbnailUrl: true,
      playbackUrl: true,
      intelligenceStatus: true,
      assetIntelligence: true,
    },
  });

  const creatives = await prisma.metaCreative.findMany({
    where: {
      assetId: { in: assetIds },
      metaIntegration: { companyId },
    },
    select: {
      assetId: true,
      ads: {
        select: { metaAdId: true, name: true },
        take: 1,
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  const byId = new Map(assets.map((a) => [a.id, a]));

  return assetIds
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((asset) => {
      const ctx = adContextForAsset(asset.id, creatives);
      const intel = asset.assetIntelligence;

      return {
        assetId: asset.id,
        title: asset.title,
        assetType: asset.assetType,
        thumbnailUrl: asset.thumbnailUrl,
        playbackUrl: asset.playbackUrl,
        intelligenceStatus: asset.intelligenceStatus,
        adName: ctx.adName,
        metaAdId: ctx.metaAdId,
        intelligence: intel
          ? {
              language: intel.language,
              contentType: intel.contentType,
              durationSeconds: intel.durationSeconds,
              theme: intel.theme,
              sentiment: intel.sentiment,
              intensityScore: intel.intensityScore,
              spiritualElements: intel.spiritualElements,
              titlePrimary: intel.titlePrimary,
              shortSummary: intel.shortSummary,
              longDescription: intel.longDescription,
              tags: intel.tags,
              tone: intel.tone,
              topics: intel.topics,
              targetAudience: intel.targetAudience,
              bestPlatforms: intel.bestPlatforms,
              visualContext: intel.visualContext,
              videoGenres: intel.videoGenres,
              missRobustaInsights: intel.missRobustaInsights,
              modelVersion: intel.modelVersion,
              confidence: intel.confidence,
              processedAt: intel.processedAt.toISOString(),
            }
          : null,
      };
    });
}

/** Latest assets with saved intelligence for the analyze-ads page on load. */
export async function getLatestIntelligenceResults(
  companyId: string,
  limit = 3,
): Promise<IntelligenceResultRow[]> {
  const rows = await prisma.assetIntelligence.findMany({
    where: { companyId },
    orderBy: { processedAt: 'desc' },
    take: limit,
    select: { assetId: true },
  });

  const assetIds = rows.map((r) => r.assetId);
  return getIntelligenceResultsForAssets(companyId, assetIds);
}
