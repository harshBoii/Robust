/**
 * Backfill Asset.thumbnailUrl for IMAGE rows using R2_PUBLIC_BASE_URL + r2Key.
 *
 * Usage:
 *   npx tsx scripts/backfill-image-thumbnails.ts
 *   npx tsx scripts/backfill-image-thumbnails.ts --dry-run
 *
 * Requires DATABASE_URL and R2_PUBLIC_BASE_URL in .env (load via dotenv).
 */

import "dotenv/config";

import { AssetType } from "@/app/generated/prisma/enums";
import { getR2PublicObjectUrl } from "@/lib/cloudfare/r2";
import { prisma } from "@/lib/prisma";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.R2_PUBLIC_BASE_URL?.trim()) {
    console.error("R2_PUBLIC_BASE_URL is not set. Add it to .env and retry.");
    process.exit(1);
  }

  const assets = await prisma.asset.findMany({
    where: {
      assetType: AssetType.IMAGE,
      OR: [{ thumbnailUrl: null }, { thumbnailUrl: "" }],
    },
    select: { id: true, r2Key: true },
  });

  console.log(`Found ${assets.length} image asset(s) without thumbnailUrl.`);

  let updated = 0;
  let skipped = 0;

  for (const a of assets) {
    const url = getR2PublicObjectUrl(a.r2Key);
    if (!url) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] ${a.id} -> ${url}`);
      updated++;
      continue;
    }
    await prisma.asset.update({
      where: { id: a.id },
      data: { thumbnailUrl: url },
    });
    updated++;
  }

  console.log(
    dryRun
      ? `[dry-run] Would update ${updated} row(s); skipped ${skipped}.`
      : `Updated ${updated} row(s); skipped ${skipped}.`,
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
