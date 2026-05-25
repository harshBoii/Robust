import 'server-only';

import { prisma } from '@/lib/prisma';

const DASHBOARD_CREATIVE_PLACEHOLDER = {
  primaryText: '',
  ctaType: 'LEARN_MORE',
  landingUrl: 'https://www.facebook.com',
} as const;

export type AdThumbnailSyncRow = {
  adId: string;
  name: string;
  thumbnailUrl: string | null;
  metaCreativeId?: string | null;
};

/** Persist Meta creative thumbnails so GET /api/dashboard can render them after refresh. */
export async function syncAdThumbnailsFromRefresh(
  metaIntegrationId: string,
  rows: AdThumbnailSyncRow[],
): Promise<void> {
  const withThumb = rows.filter((r): r is AdThumbnailSyncRow & { thumbnailUrl: string } =>
    Boolean(r.thumbnailUrl),
  );
  if (!withThumb.length) return;

  const ads = await prisma.metaAd.findMany({
    where: {
      metaIntegrationId,
      metaAdId: { in: withThumb.map((r) => r.adId) },
    },
    select: { id: true, metaAdId: true, metaCreativeDbId: true },
  });
  const adByMetaId = new Map(ads.map((a) => [a.metaAdId, a]));

  await Promise.all(
    withThumb.map(async (r) => {
      const ad = adByMetaId.get(r.adId);
      if (!ad) return;

      if (ad.metaCreativeDbId) {
        await prisma.metaCreative.update({
          where: { id: ad.metaCreativeDbId },
          data: { thumbnailUrl: r.thumbnailUrl },
        });
        return;
      }

      const headline = (r.name || r.adId).slice(0, 500);

      if (r.metaCreativeId) {
        const creative = await prisma.metaCreative.upsert({
          where: {
            metaIntegrationId_metaCreativeId: {
              metaIntegrationId,
              metaCreativeId: r.metaCreativeId,
            },
          },
          create: {
            metaIntegrationId,
            metaCreativeId: r.metaCreativeId,
            headline,
            thumbnailUrl: r.thumbnailUrl,
            aiGenerated: false,
            ...DASHBOARD_CREATIVE_PLACEHOLDER,
          },
          update: { thumbnailUrl: r.thumbnailUrl, headline },
        });
        await prisma.metaAd.update({
          where: { id: ad.id },
          data: { metaCreativeDbId: creative.id },
        });
        return;
      }

      const creative = await prisma.metaCreative.create({
        data: {
          metaIntegrationId,
          headline,
          thumbnailUrl: r.thumbnailUrl,
          aiGenerated: false,
          ...DASHBOARD_CREATIVE_PLACEHOLDER,
        },
      });
      await prisma.metaAd.update({
        where: { id: ad.id },
        data: { metaCreativeDbId: creative.id },
      });
    }),
  );
}
