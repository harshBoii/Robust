import type { GroupModel } from '@/app/components/createAd/types';
import { defaultCreativeFields } from '@/lib/create-ad/group-model';

/**
 * Split multi-asset groups into one ad per asset (each with its own creative shell).
 * Used by auto mode so N generated statics become N distinct ads.
 */
export function expandGroupsToOneAdPerAsset(groups: GroupModel[]): GroupModel[] {
  const out: GroupModel[] = [];

  for (const g of groups) {
    if (!g.included) {
      out.push(g);
      continue;
    }

    if (g.assets.length <= 1) {
      out.push(g);
      continue;
    }

    for (const asset of g.assets) {
      out.push({
        ...g,
        bucketId: `${g.bucketId}:${asset.id}`,
        label: g.assets.length > 1 ? `${g.label} · ${asset.title}` : g.label,
        assetIds: [asset.id],
        assets: [asset],
        creative: { ...g.creative },
      });
    }
  }

  return out;
}

/** Build one included group per auto-generated static (skip aspect-ratio bucketing). */
export function buildAutoStaticGroups(
  assets: Array<{
    id: string;
    title: string;
    filename?: string | null;
    thumbnailUrl: string | null;
    playbackUrl?: string | null;
    assetType: string;
    bulkUploadId: string | null;
    assetBucketId: string | null;
  }>,
  theme?: string | null,
): GroupModel[] {
  return assets.map((asset, index) => ({
    bucketId: `auto-${asset.id}`,
    label: theme ? `${theme} · ${index + 1}` : `Ad ${index + 1}`,
    assetIds: [asset.id],
    assets: [asset],
    included: true,
    adSetId: '',
    creative: defaultCreativeFields(),
  }));
}
