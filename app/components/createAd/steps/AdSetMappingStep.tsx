'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CreateFromPreset, EmptyState, json } from '../shared';
import type { AdSet, GroupModel, Preset } from '../types';

export default function AdSetMappingStep({
  campaignId,
  groups,
  onChangeGroupAdSet,
  onError,
}: {
  campaignId: string;
  groups: GroupModel[];
  onChangeGroupAdSet: (bucketId: string, adSetId: string) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [adsetPresets, setAdsetPresets] = useState<Preset[]>([]);

  const includedGroups = useMemo(() => groups.filter((g) => g.included), [groups]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [as, pAs] = await Promise.all([
          json<{ adSets: AdSet[] }>(
            await fetch(`/api/meta/adsets?campaignId=${encodeURIComponent(campaignId)}`, { credentials: 'include' }),
          ),
          json<{ presets: Preset[] }>(await fetch('/api/presets/adset', { credentials: 'include' })),
        ]);
        if (cancelled) return;
        setAdSets(as.adSets ?? []);
        setAdsetPresets(pAs.presets ?? []);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Failed to load ad sets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId, onError]);

  const createAdSetForGroup = useCallback(async (bucketId: string, presetId: string, name?: string) => {
    try {
      const data = await json<{ adSet: AdSet }>(
        await fetch('/api/meta/adsets', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetId, campaignId, name }),
        }),
      );
      setAdSets((prev) => [data.adSet, ...prev]);
      onChangeGroupAdSet(bucketId, data.adSet.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create ad set');
    }
  }, [campaignId, onChangeGroupAdSet, onError]);

  if (!campaignId) {
    return <EmptyState title="No campaign selected" message="Go back and choose a campaign first." />;
  }

  if (includedGroups.length === 0) {
    return <EmptyState title="No included groups" message="Go back and include at least one group." />;
  }

  const mappedAdSetIds = new Set(includedGroups.map((g) => g.adSetId).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Map groups to ad sets</p>
          <p className="text-xs text-muted-foreground">Each creative group can publish into a different ad set.</p>
        </div>
        {loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
      </div>

      <div className="space-y-3">
        {includedGroups.map((g) => (
          <div key={g.bucketId} className="rounded-2xl border border-border/40 bg-background/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{g.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {g.assets.length} asset{g.assets.length !== 1 ? 's' : ''}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {g.assets.slice(0, 3).map((a) => (
                    <div key={a.id} className="h-10 w-10 rounded-xl overflow-hidden bg-muted">
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
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-[360px]">
                <div>
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Existing ad set
                  </label>
                  <select
                    className="glass-input w-full px-3 py-2 text-sm"
                    value={g.adSetId}
                    onChange={(e) => onChangeGroupAdSet(g.bucketId, e.target.value)}
                  >
                    <option value="">Select an ad set…</option>
                    {adSets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    {adSets.length === 0 ? (
                      <option value="" disabled>(No ad sets yet)</option>
                    ) : null}
                  </select>
                </div>

                {mappedAdSetIds.size > 0 ? (
                  <div>
                    <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Reuse already selected
                    </label>
                    <select
                      className="glass-input w-full px-3 py-2 text-sm"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) onChangeGroupAdSet(g.bucketId, id);
                      }}
                    >
                      <option value="">Choose from mapped…</option>
                      {[...mappedAdSetIds].map((id) => {
                        const row = adSets.find((a) => a.id === id);
                        return (
                          <option key={id} value={id}>
                            {row?.name ?? id}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : null}

                <CreateFromPreset
                  presets={adsetPresets}
                  selectId={`createAdAdSetPreset-${g.bucketId}`}
                  label="Create ad set"
                  onCreate={(presetId) => createAdSetForGroup(g.bucketId, presetId, `${g.label}`.slice(0, 120))}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

