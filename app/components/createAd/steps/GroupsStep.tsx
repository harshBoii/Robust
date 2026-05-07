'use client';

import { useEffect, useMemo, useState } from 'react';

import { EmptyState, json } from '../shared';
import type { Asset, AssetBucket, GroupModel } from '../types';

type BucketsResp = {
  buckets?: Array<{
    id: string;
    label: string;
    bucketType: string;
    bucketValue: string;
    assetCount: number;
  }>;
};

type AssetsResp = { assets?: Array<{
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
  assetType: string;
  bulkUploadId?: string | null;
  assetBucketId?: string | null;
}> };

function defaultCreative() {
  return {
    headline: '',
    primaryText: '',
    description: '',
    landingUrl: '',
    ctaType: 'LEARN_MORE',
    pixelId: '',
  };
}

export default function GroupsStep({
  bulkUploadId,
  onGroupsReady,
  onError,
}: {
  bulkUploadId: string;
  onGroupsReady: (groups: GroupModel[]) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<AssetBucket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!bulkUploadId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [b, a] = await Promise.all([
          json<BucketsResp>(await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(bulkUploadId)}/analyze`, { credentials: 'include' })),
          json<AssetsResp>(await fetch(`/api/gallery/assets?bulkUploadId=${encodeURIComponent(bulkUploadId)}`, { credentials: 'include' })),
        ]);

        if (cancelled) return;

        const nextBuckets: AssetBucket[] = (b.buckets ?? []).map((x) => ({
          id: x.id,
          label: x.label,
          assetCount: x.assetCount,
        }));
        setBuckets(nextBuckets);

        const nextAssets: Asset[] = (a.assets ?? []).map((x) => ({
          id: x.id,
          title: x.title,
          thumbnailUrl: x.thumbnailUrl ?? null,
          playbackUrl: x.playbackUrl ?? null,
          assetType: x.assetType,
          bulkUploadId: x.bulkUploadId ?? null,
          assetBucketId: x.assetBucketId ?? null,
        }));
        setAssets(nextAssets);

        setIncluded(new Set(nextBuckets.map((x) => x.id)));
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Failed to load groups');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bulkUploadId, onError]);

  const groups = useMemo(() => {
    const byBucket = new Map<string, Asset[]>();
    for (const a of assets) {
      const bid = a.assetBucketId;
      if (!bid) continue;
      if (!byBucket.has(bid)) byBucket.set(bid, []);
      byBucket.get(bid)!.push(a);
    }
    return buckets.map((b) => {
      const gAssets = byBucket.get(b.id) ?? [];
      return {
        bucketId: b.id,
        label: b.label,
        assets: gAssets,
        assetIds: gAssets.map((x) => x.id),
        included: included.has(b.id),
        adSetId: '',
        creative: defaultCreative(),
      } satisfies GroupModel;
    });
  }, [buckets, assets, included]);

  useEffect(() => {
    onGroupsReady(groups);
  }, [groups, onGroupsReady]);

  if (!bulkUploadId) {
    return <EmptyState title="No upload yet" message="Upload creatives first to generate groups." />;
  }

  if (!loading && buckets.length === 0) {
    return <EmptyState title="No groups found" message="Try uploading again or wait for analysis to finish." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Creative groups</p>
          <p className="text-xs text-muted-foreground">These are auto-generated from your uploaded batch.</p>
        </div>
        <span className="glass-badge">{buckets.length} group{buckets.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.bucketId} className="rounded-2xl border border-border/40 bg-background/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{g.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {g.assets.length} asset{g.assets.length !== 1 ? 's' : ''}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={included.has(g.bucketId)}
                  onChange={(e) => {
                    const next = new Set(included);
                    if (e.target.checked) next.add(g.bucketId);
                    else next.delete(g.bucketId);
                    setIncluded(next);
                  }}
                />
                Include
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {g.assets.slice(0, 3).map((a) => (
                <div key={a.id} className="h-12 w-12 rounded-xl overflow-hidden bg-muted">
                  {a.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumbnailUrl} alt={a.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground/60">
                      {a.assetType}
                    </div>
                  )}
                </div>
              ))}
              {g.assets.length > 3 ? (
                <span className="text-xs text-muted-foreground">+{g.assets.length - 3}</span>
              ) : null}
            </div>

            {!included.has(g.bucketId) ? (
              <p className="mt-3 text-[11px] text-muted-foreground/70">
                Excluded — this group won’t be published.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

