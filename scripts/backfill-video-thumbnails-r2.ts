/**
 * Backfill public R2 JPEG thumbnails for VIDEO assets (from Stream thumbnail URL or re-fetch).
 *
 * Usage:
 *   npx tsx scripts/backfill-video-thumbnails-r2.ts
 *   npx tsx scripts/backfill-video-thumbnails-r2.ts --dry-run
 *   npx tsx scripts/backfill-video-thumbnails-r2.ts --limit=50
 *
 * Requires DATABASE_URL, R2_PUBLIC_BASE_URL, and R2 credentials in .env.
 */

import 'dotenv/config';

import { AssetType } from '@/app/generated/prisma/enums';
import { syncStreamThumbnailToR2 } from '@/lib/cloudfare/r2-video-thumbnail';
import { isCloudflareStreamUrl, isR2PublicObjectUrl } from '@/lib/meta/r2-thumbnail-url';
import { prisma } from '@/lib/prisma';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : undefined;

async function main() {
  if (!process.env.R2_PUBLIC_BASE_URL?.trim()) {
    console.error('R2_PUBLIC_BASE_URL is not set. Add it to .env and retry.');
    process.exit(1);
  }

  const assets = await prisma.asset.findMany({
    where: {
      assetType: AssetType.VIDEO,
      r2Key: { not: '' },
      r2Bucket: { not: '' },
    },
    select: {
      id: true,
      r2Key: true,
      r2Bucket: true,
      thumbnailUrl: true,
    },
    ...(limit != null && Number.isFinite(limit) ? { take: limit } : {}),
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Checking ${assets.length} video asset(s).`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of assets) {
    if (a.thumbnailUrl && isR2PublicObjectUrl(a.thumbnailUrl)) {
      skipped++;
      continue;
    }

    const streamThumb =
      a.thumbnailUrl && isCloudflareStreamUrl(a.thumbnailUrl) ? a.thumbnailUrl : null;

    if (!streamThumb) {
      console.warn(`[skip] ${a.id}: no Stream thumbnailUrl to sync`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${a.id} <- sync from Stream`);
      updated++;
      continue;
    }

    try {
      const r2Thumb = await syncStreamThumbnailToR2({
        r2Bucket: a.r2Bucket,
        videoR2Key: a.r2Key,
        streamThumbnailUrl: streamThumb,
      });
      if (!r2Thumb?.publicUrl) {
        console.warn(`[fail] ${a.id}: R2 upload returned no URL`);
        failed++;
        continue;
      }
      await prisma.asset.update({
        where: { id: a.id },
        data: { thumbnailUrl: r2Thumb.publicUrl },
      });
      console.log(`[ok] ${a.id} -> ${r2Thumb.publicUrl}`);
      updated++;
    } catch (e) {
      console.error(`[fail] ${a.id}:`, e);
      failed++;
    }
  }

  console.log(
    dryRun
      ? `[dry-run] Would update ${updated}; skipped ${skipped}; failed ${failed}.`
      : `Updated ${updated}; skipped ${skipped}; failed ${failed}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
