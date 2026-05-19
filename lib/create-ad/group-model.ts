import type { Asset, AssetBucket, GroupModel } from '@/app/components/createAd/types';

export type { Asset, AssetBucket, GroupModel };

export function defaultCreativeFields() {
  return {
    headline: '',
    primaryText: '',
    description: '',
    landingUrl: '',
    ctaType: 'LEARN_MORE',
    pixelId: '',
  };
}

export function buildGroupsFromBuckets(
  buckets: AssetBucket[],
  assets: Asset[],
  includedBucketIds?: Set<string>,
): GroupModel[] {
  const byBucket = new Map<string, Asset[]>();
  for (const a of assets) {
    if (!a.assetBucketId) continue;
    if (!byBucket.has(a.assetBucketId)) byBucket.set(a.assetBucketId, []);
    byBucket.get(a.assetBucketId)!.push(a);
  }

  const included =
    includedBucketIds && includedBucketIds.size > 0
      ? includedBucketIds
      : new Set(buckets.map((b) => b.id));

  return buckets.map((b) => {
    const gAssets = byBucket.get(b.id) ?? [];
    return {
      bucketId: b.id,
      label: b.label,
      assets: gAssets,
      assetIds: gAssets.map((x) => x.id),
      included: included.has(b.id),
      adSetId: '',
      creative: defaultCreativeFields(),
    };
  });
}
