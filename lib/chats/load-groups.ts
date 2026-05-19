import 'server-only';

import { prisma } from '@/lib/prisma';
import { analyzeBulkUpload } from '@/lib/gallery/analyze-bulk';
import { buildGroupsFromBuckets } from '@/lib/create-ad/group-model';
import type { Asset, AssetBucket } from '@/lib/create-ad/group-model';

export async function loadGroupsForBulk(
  bulkUploadId: string,
  companyId: string,
  opts?: { runContentAnalyze?: boolean },
) {
  if (opts?.runContentAnalyze) {
    await analyzeBulkUpload(bulkUploadId, companyId, 'content');
  }

  const buckets = await prisma.assetBucket.findMany({
    where: { bulkUploadId, companyId },
    select: { id: true, label: true },
    orderBy: { label: 'asc' },
  });

  const assets = await prisma.asset.findMany({
    where: { bulkUploadId, companyId },
    select: {
      id: true,
      title: true,
      assetType: true,
      bulkUploadId: true,
      assetBucketId: true,
      thumbnailUrl: true,
      playbackUrl: true,
    },
  });

  const mappedAssets: Asset[] = assets.map((a) => ({
    id: a.id,
    title: a.title,
    thumbnailUrl: a.thumbnailUrl,
    playbackUrl: a.playbackUrl,
    assetType: a.assetType,
    bulkUploadId: a.bulkUploadId,
    assetBucketId: a.assetBucketId,
  }));

  const mappedBuckets: AssetBucket[] = buckets.map((b) => ({
    id: b.id,
    label: b.label,
  }));

  const groups = buildGroupsFromBuckets(mappedBuckets, mappedAssets);
  return { groups, buckets: mappedBuckets, assets: mappedAssets };
}
