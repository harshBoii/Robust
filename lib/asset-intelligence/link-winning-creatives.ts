import 'server-only';

import type { MetaAdCreativeDetails } from '@/lib/meta/client';
import { getMetaAdCreativeDetails } from '@/lib/meta/client';
import { requireMetaAdAccountId } from '@/lib/meta/integration-token';
import { prisma } from '@/lib/prisma';

import { importMetaCreativeToGallery } from './import-meta-creative';
import { listWinningMetaAds, WinnersQueryError } from './winners';

const TARGET_LINKED = 3;

export type LinkWinningCreativesResult = {
  linked: number;
  alreadyLinked: number;
  imported: number;
  noGalleryMatch: number;
  metaFetchFailed: number;
  noMediaOnMeta: number;
  importFailed: number;
  winningAdsConsidered: number;
  details: Array<{
    metaAdId: string;
    status:
      | 'linked'
      | 'already_linked'
      | 'imported'
      | 'no_gallery_match'
      | 'no_media_on_meta'
      | 'meta_fetch_failed'
      | 'import_failed';
    assetId?: string;
    message?: string;
  }>;
};

export { WinnersQueryError };

async function attachCreativeToAd(input: {
  metaIntegrationId: string;
  metaAdDbId: string;
  assetId: string;
  metaDetails: MetaAdCreativeDetails;
  imageHash: string | null;
  videoId: string | null;
  defaultLanding: string;
  adName: string | null;
}): Promise<void> {
  let creative = await prisma.metaCreative.findFirst({
    where: {
      metaIntegrationId: input.metaIntegrationId,
      assetId: input.assetId,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  if (!creative) {
    creative = await prisma.metaCreative.findFirst({
      where: {
        metaIntegrationId: input.metaIntegrationId,
        OR: [
          ...(input.imageHash ? [{ imageHash: input.imageHash }] : []),
          ...(input.videoId ? [{ videoId: input.videoId }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
  }

  if (!creative) {
    const created = await prisma.metaCreative.create({
      data: {
        metaIntegrationId: input.metaIntegrationId,
        assetId: input.assetId,
        metaCreativeId: input.metaDetails.metaCreativeId,
        imageHash: input.imageHash,
        videoId: input.videoId,
        headline:
          input.metaDetails.headline ??
          input.metaDetails.adName ??
          input.adName ??
          'Winning ad',
        primaryText: input.metaDetails.primaryText ?? '',
        description: input.metaDetails.description,
        ctaType: input.metaDetails.ctaType ?? 'LEARN_MORE',
        landingUrl: input.metaDetails.landingUrl ?? input.defaultLanding,
        thumbnailUrl: input.metaDetails.thumbnailUrl,
        aiGenerated: false,
      },
      select: { id: true },
    });
    creative = created;
  } else {
    await prisma.metaCreative.update({
      where: { id: creative.id },
      data: {
        assetId: input.assetId,
        imageHash: input.imageHash ?? undefined,
        videoId: input.videoId ?? undefined,
        metaCreativeId: input.metaDetails.metaCreativeId ?? undefined,
      },
    });
  }

  await prisma.metaAd.update({
    where: { id: input.metaAdDbId },
    data: { metaCreativeDbId: creative.id },
  });

  await prisma.metaMedia.upsert({
    where: { assetId: input.assetId },
    create: {
      metaIntegrationId: input.metaIntegrationId,
      kind: input.videoId ? 'video' : 'image',
      imageHash: input.imageHash,
      videoId: input.videoId,
      assetId: input.assetId,
      thumbnailUrl: input.metaDetails.thumbnailUrl,
      status: 'ready',
    },
    update: {
      imageHash: input.imageHash ?? undefined,
      videoId: input.videoId ?? undefined,
      thumbnailUrl: input.metaDetails.thumbnailUrl ?? undefined,
    },
  });
}

export async function linkWinningAdCreatives(
  companyId: string,
): Promise<LinkWinningCreativesResult> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true, adAccountId: true },
  });

  if (!integration) {
    throw new WinnersQueryError('Meta integration not connected', 400);
  }

  let adAccountId: string;
  try {
    adAccountId = requireMetaAdAccountId(integration.adAccountId);
  } catch {
    throw new WinnersQueryError(
      'Configure Meta ad account in workspace settings',
      400,
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { website: true },
  });
  const defaultLanding = company?.website?.trim() || 'https://example.com';

  const winners = await listWinningMetaAds(companyId, 15);

  const result: LinkWinningCreativesResult = {
    linked: 0,
    alreadyLinked: 0,
    imported: 0,
    noGalleryMatch: 0,
    metaFetchFailed: 0,
    noMediaOnMeta: 0,
    importFailed: 0,
    winningAdsConsidered: winners.length,
    details: [],
  };

  let totalWithGallery = 0;

  for (const winner of winners) {
    if (totalWithGallery >= TARGET_LINKED) break;

    if (winner.hasLinkedAsset && winner.assetId) {
      result.alreadyLinked += 1;
      totalWithGallery += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'already_linked',
        assetId: winner.assetId,
      });
      continue;
    }

    let metaDetails: MetaAdCreativeDetails;
    try {
      metaDetails = await getMetaAdCreativeDetails({
        companyId,
        metaAdId: winner.metaAdId,
      });
    } catch (e) {
      result.metaFetchFailed += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'meta_fetch_failed',
        message: e instanceof Error ? e.message : 'Meta API error',
      });
      continue;
    }

    if (!metaDetails.imageHash && !metaDetails.videoId) {
      result.noMediaOnMeta += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'no_media_on_meta',
      });
      continue;
    }

    let assetId: string | null = null;
    let imported = false;

    const media = await prisma.metaMedia.findFirst({
      where: {
        metaIntegrationId: integration.id,
        assetId: { not: null },
        OR: [
          ...(metaDetails.imageHash
            ? [{ imageHash: metaDetails.imageHash }]
            : []),
          ...(metaDetails.videoId ? [{ videoId: metaDetails.videoId }] : []),
        ],
      },
      select: { assetId: true },
    });

    if (media?.assetId) {
      const existing = await prisma.asset.findFirst({
        where: { id: media.assetId, companyId },
        select: { id: true, status: true, assetType: true, r2Key: true },
      });
      if (
        existing &&
        (existing.status === 'READY' ||
          (existing.assetType === 'VIDEO' && existing.r2Key))
      ) {
        assetId = existing.id;
      }
    }

    if (!assetId) {
      try {
        const imp = await importMetaCreativeToGallery({
          companyId,
          adAccountId,
          metaDetails,
          adTitle: winner.adName,
        });
        assetId = imp.assetId;
        imported = true;
      } catch (e) {
        result.importFailed += 1;
        result.noGalleryMatch += 1;
        result.details.push({
          metaAdId: winner.metaAdId,
          status: 'import_failed',
          message: e instanceof Error ? e.message : 'Import from Meta failed',
        });
        continue;
      }
    }

    if (!assetId) {
      result.noGalleryMatch += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'no_gallery_match',
      });
      continue;
    }

    try {
      await attachCreativeToAd({
        metaIntegrationId: integration.id,
        metaAdDbId: winner.metaAdDbId,
        assetId,
        metaDetails,
        imageHash: metaDetails.imageHash,
        videoId: metaDetails.videoId,
        defaultLanding,
        adName: winner.adName,
      });
    } catch (e) {
      result.importFailed += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'import_failed',
        message: e instanceof Error ? e.message : 'Failed to link creative',
      });
      continue;
    }

    if (imported) {
      result.imported += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'imported',
        assetId,
      });
    } else {
      result.linked += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'linked',
        assetId,
      });
    }
    totalWithGallery += 1;
  }

  return result;
}
