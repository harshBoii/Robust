import 'server-only';

import { getMetaAdCreativeDetails } from '@/lib/meta/client';
import { prisma } from '@/lib/prisma';

import { listWinningMetaAds, WinnersQueryError } from './winners';

const TARGET_LINKED = 3;

export type LinkWinningCreativesResult = {
  linked: number;
  alreadyLinked: number;
  noGalleryMatch: number;
  metaFetchFailed: number;
  noMediaOnMeta: number;
  winningAdsConsidered: number;
  details: Array<{
    metaAdId: string;
    status:
      | 'linked'
      | 'already_linked'
      | 'no_gallery_match'
      | 'no_media_on_meta'
      | 'meta_fetch_failed';
    assetId?: string;
    message?: string;
  }>;
};

export { WinnersQueryError };

export async function linkWinningAdCreatives(
  companyId: string,
): Promise<LinkWinningCreativesResult> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });

  if (!integration) {
    throw new WinnersQueryError('Meta integration not connected', 400);
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { website: true },
  });
  const defaultLanding =
    company?.website?.trim() || 'https://example.com';

  const winners = await listWinningMetaAds(companyId, 15);

  const result: LinkWinningCreativesResult = {
    linked: 0,
    alreadyLinked: 0,
    noGalleryMatch: 0,
    metaFetchFailed: 0,
    noMediaOnMeta: 0,
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

    let metaDetails;
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
      select: { assetId: true, imageHash: true, videoId: true },
    });

    if (!media?.assetId) {
      result.noGalleryMatch += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'no_gallery_match',
        message:
          'No gallery upload found for this Meta image_hash/video_id. Publish the same asset from Robust first.',
      });
      continue;
    }

    const asset = await prisma.asset.findFirst({
      where: { id: media.assetId, companyId, status: 'READY' },
      select: { id: true },
    });

    if (!asset) {
      result.noGalleryMatch += 1;
      result.details.push({
        metaAdId: winner.metaAdId,
        status: 'no_gallery_match',
        message: 'Matched media is not a READY gallery asset.',
      });
      continue;
    }

    let creative = await prisma.metaCreative.findFirst({
      where: {
        metaIntegrationId: integration.id,
        assetId: asset.id,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!creative) {
      creative = await prisma.metaCreative.findFirst({
        where: {
          metaIntegrationId: integration.id,
          OR: [
            ...(metaDetails.imageHash
              ? [{ imageHash: metaDetails.imageHash }]
              : []),
            ...(metaDetails.videoId ? [{ videoId: metaDetails.videoId }] : []),
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
    }

    if (!creative) {
      const created = await prisma.metaCreative.create({
        data: {
          metaIntegrationId: integration.id,
          assetId: asset.id,
          metaCreativeId: metaDetails.metaCreativeId,
          imageHash: metaDetails.imageHash ?? media.imageHash,
          videoId: metaDetails.videoId ?? media.videoId,
          headline:
            metaDetails.headline ??
            metaDetails.adName ??
            winner.adName ??
            'Winning ad',
          primaryText: metaDetails.primaryText ?? '',
          description: metaDetails.description,
          ctaType: metaDetails.ctaType ?? 'LEARN_MORE',
          landingUrl: metaDetails.landingUrl ?? defaultLanding,
          thumbnailUrl: metaDetails.thumbnailUrl,
          aiGenerated: false,
        },
        select: { id: true },
      });
      creative = created;
    } else {
      await prisma.metaCreative.update({
        where: { id: creative.id },
        data: {
          assetId: asset.id,
          imageHash: metaDetails.imageHash ?? undefined,
          videoId: metaDetails.videoId ?? undefined,
          metaCreativeId: metaDetails.metaCreativeId ?? undefined,
        },
      });
    }

    await prisma.metaAd.update({
      where: { id: winner.metaAdDbId },
      data: { metaCreativeDbId: creative.id },
    });

    result.linked += 1;
    totalWithGallery += 1;
    result.details.push({
      metaAdId: winner.metaAdId,
      status: 'linked',
      assetId: asset.id,
    });
  }

  return result;
}
