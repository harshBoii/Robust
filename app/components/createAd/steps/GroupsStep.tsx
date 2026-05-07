'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 15_000;

function toAssets(list: AssetsResp['assets']): Asset[] {
  return (list ?? []).map((x) => ({
    id: x.id,
    title: x.title,
    thumbnailUrl: x.thumbnailUrl ?? null,
    playbackUrl: x.playbackUrl ?? null,
    assetType: x.assetType,
    bulkUploadId: x.bulkUploadId ?? null,
    assetBucketId: x.assetBucketId ?? null,
  }));
}

function toBuckets(list: BucketsResp['buckets']): AssetBucket[] {
  return (list ?? []).map((x) => ({ id: x.id, label: x.label, assetCount: x.assetCount }));
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
  const [loading, setLoading]     = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [timedOut, setTimedOut]   = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [retryKey, setRetryKey]   = useState(0);   // increment to restart the effect

  const [buckets, setBuckets] = useState<AssetBucket[]>([]);
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [included, setIncluded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (id: string) => {
    const [b, a] = await Promise.all([
      json<BucketsResp>(await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`, { credentials: 'include' })),
      json<AssetsResp>(await fetch(`/api/gallery/assets?bulkUploadId=${encodeURIComponent(id)}`, { credentials: 'include' })),
    ]);
    return { b, a };
  }, []);

  // Re-kick the background analyze POST (used on retry)
  const triggerAnalyze = useCallback((id: string) => {
    void fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'content' }),
    });
  }, []);

  useEffect(() => {
    if (!bulkUploadId) return;
    let cancelled = false;

    // Reset per-run state
    setLoading(true);
    setAnalyzing(false);
    setTimedOut(false);
    setPollAttempt(0);

    void (async () => {
      try {
        // Initial fetch — check if buckets already exist from a prior run
        const { b, a } = await fetchData(bulkUploadId);
        if (cancelled) return;

        const initial = toBuckets(b.buckets);

        if (initial.length > 0) {
          setBuckets(initial);
          setAssets(toAssets(a.assets));
          setIncluded(new Set(initial.map((x) => x.id)));
          setLoading(false);
          return;
        }

        // No buckets yet — enter polling mode
        setLoading(false);
        setAnalyzing(true);

        for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
          await new Promise<void>((res) => setTimeout(res, POLL_INTERVAL_MS));
          if (cancelled) return;

          setPollAttempt(attempt);

          const { b: bPoll, a: aPoll } = await fetchData(bulkUploadId);
          if (cancelled) return;

          const polled = toBuckets(bPoll.buckets);

          if (polled.length > 0) {
            setBuckets(polled);
            setAssets(toAssets(aPoll.assets));
            setIncluded(new Set(polled.map((x) => x.id)));
            setAnalyzing(false);
            return;
          }
        }

        // Exhausted — surface latest assets so the Retry banner is meaningful
        const { a: aFresh } = await fetchData(bulkUploadId);
        if (!cancelled) {
          setAssets(toAssets(aFresh.assets));
          setAnalyzing(false);
          setTimedOut(true);
        }
      } catch (e) {
        if (!cancelled) {
          onError(e instanceof Error ? e.message : 'Failed to load groups');
          setLoading(false);
          setAnalyzing(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // retryKey intentionally re-triggers this effect on manual retry
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkUploadId, fetchData, retryKey]);

  const handleRetry = useCallback(() => {
    if (!bulkUploadId) return;
    triggerAnalyze(bulkUploadId);
    setRetryKey((k) => k + 1);
  }, [bulkUploadId, triggerAnalyze]);

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

  /* ── guards ── */
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

  if (analyzing) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Analyzing creative groups…</p>
          <p className="text-xs text-muted-foreground">
            Videos are still being processed by Cloudflare Stream.
            <br />Groups will appear automatically — this usually takes 1–3 minutes.
          </p>
          {pollAttempt > 0 ? (
            <p className="font-ui text-[11px] text-muted-foreground/60">
              Check {pollAttempt} / {MAX_POLL_ATTEMPTS} · next in ~15 s
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
          <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Analysis timed out</p>
          <p className="text-xs text-muted-foreground">
            Cloudflare Stream is taking longer than expected to process your videos
            ({MAX_POLL_ATTEMPTS} checks over ~5 min).
            <br />Click <strong>Retry</strong> to wait further, or proceed without groups.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="glass-button-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retry analysis
        </button>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No groups found</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Analysis completed but produced no groups. This can happen if all videos are still encoding.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="glass-button flex items-center gap-2 px-4 py-2 text-sm"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retry analysis
        </button>
      </div>
    );
  }

  /* ── groups found ── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Creative groups</p>
          <p className="text-xs text-muted-foreground">Auto-generated from your uploaded batch.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            title="Re-run analysis"
            className="glass-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Re-analyze
          </button>
          <span className="glass-badge">{buckets.length} group{buckets.length !== 1 ? 's' : ''}</span>
        </div>
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
                Excluded — this group won't be published.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
