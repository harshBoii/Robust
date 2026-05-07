'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, json } from '../shared';
import type { Asset, AssetBucket, GroupModel } from '../types';

/* ── API response shapes ──────────────────────────────────────────────────── */
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
    status?: string;
    bulkUploadId?: string | null;
    assetBucketId?: string | null;
  }>;
};

type SseAsset = {
  id: string;
  status: string;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
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

function normaliseBuckets(raw: BucketsResp['buckets']): AssetBucket[] {
  return (raw ?? []).map((x) => ({ id: x.id, label: x.label, assetCount: x.assetCount }));
}

function normaliseAssets(raw: AssetsResp['assets']): Asset[] {
  return (raw ?? []).map((x) => ({
    id: x.id,
    title: x.title,
    thumbnailUrl: x.thumbnailUrl ?? null,
    playbackUrl: x.playbackUrl ?? null,
    assetType: x.assetType,
    bulkUploadId: x.bulkUploadId ?? null,
    assetBucketId: x.assetBucketId ?? null,
  }));
}

/* ── Component ────────────────────────────────────────────────────────────── */
export default function GroupsStep({
  bulkUploadId,
  uploadedAssetIds,
  onGroupsReady,
  onError,
}: {
  bulkUploadId: string;
  /** Asset IDs that were just uploaded — used to watch for video readiness. */
  uploadedAssetIds?: string[];
  onGroupsReady: (groups: GroupModel[]) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  /** true while the content-mode upgrade is being fetched / analyzed */
  const [refining, setRefining] = useState(false);
  const [buckets, setBuckets] = useState<AssetBucket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const sseRef = useRef<EventSource | null>(null);

  /* ── fetch helpers ──────────────────────────────────────────────────────── */
  const fetchBuckets = useCallback(async (id: string): Promise<AssetBucket[]> => {
    const b = await json<BucketsResp>(
      await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`, { credentials: 'include' }),
    );
    return normaliseBuckets(b.buckets);
  }, []);

  const fetchAssets = useCallback(async (id: string): Promise<Asset[]> => {
    const a = await json<AssetsResp>(
      await fetch(`/api/gallery/assets?bulkUploadId=${encodeURIComponent(id)}`, { credentials: 'include' }),
    );
    return normaliseAssets(a.assets);
  }, []);

  /* ── Phase-2: content re-analysis once all videos are READY ──────────────
   * Merges the new buckets while preserving include/exclude choices the user
   * may have already made on the metadata groups.
   */
  const upgradeToContent = useCallback(async (id: string) => {
    setRefining(true);
    try {
      // Fire content analysis (awaited here since we want the result)
      await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'content' }),
      });

      const [newBuckets, newAssets] = await Promise.all([
        fetchBuckets(id),
        fetchAssets(id),
      ]);

      setBuckets(newBuckets);
      setAssets(newAssets);
      // Preserve existing include choices; newly appearing buckets default to included
      setIncluded((prev) => {
        const next = new Set(prev);
        for (const b of newBuckets) {
          if (!next.has(b.id)) next.add(b.id);
        }
        return next;
      });
    } catch {
      // Non-fatal — user already has the metadata groups
    } finally {
      setRefining(false);
    }
  }, [fetchBuckets, fetchAssets]);

  /* ── Phase-1: load metadata groups immediately ──────────────────────────── */
  useEffect(() => {
    if (!bulkUploadId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        // Metadata groups are usually available within ~200 ms of upload completion.
        // Retry a few times quickly in case the background POST hasn't settled yet.
        let metaBuckets: AssetBucket[] = [];
        let metaAssets: Asset[] = [];

        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) {
            await new Promise<void>((r) => setTimeout(r, 1500));
          }
          if (cancelled) return;

          const [b, a] = await Promise.all([fetchBuckets(bulkUploadId), fetchAssets(bulkUploadId)]);
          if (cancelled) return;

          if (b.length > 0) {
            metaBuckets = b;
            metaAssets = a;
            break;
          }
          // Buckets not ready yet — re-fire metadata analyze and retry
          void fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(bulkUploadId)}/analyze`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'metadata' }),
          });
        }

        if (cancelled) return;

        setBuckets(metaBuckets);
        setAssets(metaAssets);
        setIncluded(new Set(metaBuckets.map((b) => b.id)));

        /* ── Phase-2 setup: watch video assets via SSE ──────────────────────
         * Only kick off if there are video assets still PROCESSING.
         */
        const videoIds = (uploadedAssetIds ?? metaAssets
          .filter((a) => a.assetType === 'VIDEO')
          .map((a) => a.id));

        if (videoIds.length === 0) return; // no videos — metadata groups are final

        // Check current statuses first before opening SSE
        const statusResp = await json<{ assets?: SseAsset[] }>(
          await fetch(`/api/assets/status?ids=${videoIds.join(',')}`, { credentials: 'include' }),
        ).catch(() => ({ assets: [] as SseAsset[] }));

        if (cancelled) return;

        const notReady = (statusResp?.assets ?? []).filter(
          (a) => a.status !== 'READY' && a.status !== 'ERROR',
        );

        if (notReady.length === 0) {
          // All videos already READY — upgrade content immediately
          void upgradeToContent(bulkUploadId);
          return;
        }

        // Open SSE to watch for readiness
        if (sseRef.current) sseRef.current.close();
        const sse = new EventSource(`/api/assets/status?ids=${videoIds.join(',')}`);
        sseRef.current = sse;

        sse.onmessage = (e) => {
          if (cancelled) { sse.close(); return; }
          const data = JSON.parse(e.data as string) as { assets?: SseAsset[]; done?: boolean };

          // Update thumbnails/playbackUrls in local asset list as they trickle in
          if (data.assets) {
            setAssets((prev) => prev.map((a) => {
              const updated = (data.assets ?? []).find((u) => u.id === a.id);
              if (!updated) return a;
              return {
                ...a,
                thumbnailUrl: updated.thumbnailUrl ?? a.thumbnailUrl,
                playbackUrl: updated.playbackUrl ?? a.playbackUrl,
              };
            }));
          }

          if (data.done) {
            sse.close();
            sseRef.current = null;
            void upgradeToContent(bulkUploadId);
          }
        };

        sse.onerror = () => {
          sse.close();
          sseRef.current = null;
        };
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : 'Failed to load groups');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [bulkUploadId, uploadedAssetIds, fetchBuckets, fetchAssets, upgradeToContent, onError]);

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
    onGroupsReady(groups);
  }, [groups, onGroupsReady]);

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
        </div>
        <span className="glass-badge">{buckets.length} group{buckets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Refining banner — shown while content upgrade runs in background */}
      {refining ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5">
          <svg className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-xs text-primary">
            Videos are ready — refining groups with content analysis…
          </p>
        </div>
      ) : null}

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
                    if (e.target.checked) next.add(g.bucketId); else next.delete(g.bucketId);
                    setIncluded(next);
                  }}
                />
                Include
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {g.assets.slice(0, 3).map((a) => (
                <div key={a.id} className="h-12 w-12 rounded-xl overflow-hidden bg-muted relative">
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
