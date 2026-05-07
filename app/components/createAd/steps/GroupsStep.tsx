'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

type AssetsResp = {
  assets?: Array<{
    id: string;
    title: string;
    thumbnailUrl?: string | null;
    playbackUrl?: string | null;
    assetType: string;
    bulkUploadId?: string | null;
    assetBucketId?: string | null;
  }>;
};

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
  const [retrying, setRetrying] = useState(false);
  const [dragOverBucketId, setDragOverBucketId] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<AssetBucket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());

  // Parent passes inline callbacks; keep stable refs to avoid effect loops.
  const onErrorRef = useRef(onError);
  const onGroupsReadyRef = useRef(onGroupsReady);
  useEffect(() => {
    onErrorRef.current = onError;
    onGroupsReadyRef.current = onGroupsReady;
  }, [onError, onGroupsReady]);

  async function loadGroups(id: string, opts?: { keepIncluded?: boolean }) {
    const [b, a] = await Promise.all([
      json<BucketsResp>(
        await fetch(
          `/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`,
          { credentials: 'include' },
        ),
      ),
      json<AssetsResp>(
        await fetch(
          `/api/gallery/assets?bulkUploadId=${encodeURIComponent(id)}`,
          { credentials: 'include' },
        ),
      ),
    ]);

    const nextBuckets: AssetBucket[] = (b.buckets ?? []).map((x) => ({
      id: x.id,
      label: x.label,
      assetCount: x.assetCount,
    }));
    const nextAssets: Asset[] = (a.assets ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      thumbnailUrl: x.thumbnailUrl ?? null,
      playbackUrl: x.playbackUrl ?? null,
      assetType: x.assetType,
      bulkUploadId: x.bulkUploadId ?? null,
      assetBucketId: x.assetBucketId ?? null,
    }));

    setBuckets(nextBuckets);
    setAssets(nextAssets);

    if (opts?.keepIncluded) {
      setIncluded((prev) => {
        const next = new Set<string>();
        const valid = new Set(nextBuckets.map((x) => x.id));
        for (const id of prev) if (valid.has(id)) next.add(id);
        return next.size ? next : new Set(nextBuckets.map((x) => x.id));
      });
    } else {
      setIncluded(new Set(nextBuckets.map((x) => x.id)));
    }
  }

  useEffect(() => {
    if (!bulkUploadId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await loadGroups(bulkUploadId);
        if (cancelled) return;
      } catch (e) {
        onErrorRef.current(e instanceof Error ? e.message : 'Failed to load groups');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bulkUploadId]);

  /* ── Derived groups list ─────────────────────────────────────────────────── */
  const groups = useMemo<GroupModel[]>(() => {
    const byBucket = new Map<string, Asset[]>();
    for (const a of assets) {
      if (!a.assetBucketId) continue;
      if (!byBucket.has(a.assetBucketId)) byBucket.set(a.assetBucketId, []);
      byBucket.get(a.assetBucketId)!.push(a);
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
    onGroupsReadyRef.current(groups);
  }, [groups]);

  async function retryContentGrouping() {
    if (!bulkUploadId) return;
    setRetrying(true);
    setLoading(true);
    try {
      await fetch(
        `/api/gallery/bulk-uploads/${encodeURIComponent(bulkUploadId)}/analyze`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'content' }),
        },
      );
      await loadGroups(bulkUploadId, { keepIncluded: true });
    } catch (e) {
      onErrorRef.current(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }

  async function moveAssetToBucket(assetId: string, toBucketId: string) {
    if (!bulkUploadId) return;
    // optimistic UI
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, assetBucketId: toBucketId } : a)),
    );
    try {
      await fetch(
        `/api/gallery/bulk-uploads/${encodeURIComponent(bulkUploadId)}/move-asset`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId, toBucketId }),
        },
      );
      await loadGroups(bulkUploadId, { keepIncluded: true });
    } catch (e) {
      onErrorRef.current(e instanceof Error ? e.message : 'Failed to move asset');
      await loadGroups(bulkUploadId, { keepIncluded: true });
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  if (!bulkUploadId) {
    return <EmptyState title="No upload yet" message="Upload creatives first to generate groups." />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm">Loading groups…</p>
      </div>
    );
  }

  if (buckets.length === 0) {
    return <EmptyState title="No groups found" message="Analysis finished but produced no groups. Go back and re-upload, or continue without groups." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Creative groups</p>
          <p className="text-xs text-muted-foreground">
            Auto-grouped from your uploaded batch.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Tip: drag a thumbnail and drop it onto another group to move it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={retryContentGrouping}
            disabled={loading || retrying}
            className="rounded-xl border border-border/40 bg-background/20 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background/30 disabled:opacity-60"
            title="Re-run content-based grouping for this upload"
          >
            {retrying ? 'Retrying…' : 'Retry content grouping'}
          </button>
          <span className="glass-badge">{buckets.length} group{buckets.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.bucketId}
            className={[
              'rounded-2xl border bg-background/20 p-4',
              dragOverBucketId === g.bucketId ? 'border-primary/60' : 'border-border/40',
            ].join(' ')}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverBucketId(g.bucketId);
            }}
            onDragLeave={() => {
              setDragOverBucketId((cur) => (cur === g.bucketId ? null : cur));
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverBucketId(null);
              const assetId = e.dataTransfer.getData('text/plain');
              if (!assetId) return;
              void moveAssetToBucket(assetId, g.bucketId);
            }}
          >
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
                    if (e.target.checked) next.add(g.bucketId); else next.delete(g.bucketId);
                    setIncluded(next);
                  }}
                />
                Include
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {g.assets.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="h-12 w-12 rounded-xl overflow-hidden bg-muted relative cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', a.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  {a.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumbnailUrl} alt={a.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground/60">
                      {a.assetType === 'VIDEO' ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <span>{a.assetType}</span>
                      )}
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
                Excluded — this group won't be published.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
