'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CreateFromPreset, EmptyState, SelectCard, json } from '../shared';
import type { Campaign, Preset } from '../types';

export default function CampaignStep({
  selectedCampaignId,
  onChangeCampaignId,
  onError,
}: {
  selectedCampaignId: string;
  onChangeCampaignId: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignPresets, setCampaignPresets] = useState<Preset[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [c, pC] = await Promise.all([
          json<{ campaigns: Campaign[] }>(await fetch('/api/meta/campaigns', { credentials: 'include' })),
          json<{ presets: Preset[] }>(await fetch('/api/presets/campaign', { credentials: 'include' })),
        ]);
        if (cancelled) return;
        setCampaigns(c.campaigns ?? []);
        setCampaignPresets(pC.presets ?? []);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Failed to load campaigns');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [onError]);

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const createCampaign = useCallback(async (presetId: string) => {
    try {
      const data = await json<{ campaign: Campaign }>(
        await fetch('/api/meta/campaigns', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetId }),
        }),
      );
      setCampaigns((prev) => [data.campaign, ...prev]);
      onChangeCampaignId(data.campaign.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create campaign');
    }
  }, [onChangeCampaignId, onError]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Select a campaign</p>
          <p className="text-xs text-muted-foreground">Choose an existing campaign or create one from a preset.</p>
        </div>
        {loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
      </div>

      {campaigns.length === 0 && !loading ? (
        <EmptyState title="No campaigns found" message="Create one from a preset below." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <SelectCard
              key={c.id}
              selected={selectedCampaignId === c.id}
              onClick={() => onChangeCampaignId(c.id)}
              title={c.name}
              sub={[c.objective, c.status].filter(Boolean).join(' · ') || undefined}
            />
          ))}
        </div>
      )}

      <CreateFromPreset
        presets={campaignPresets}
        selectId="createAdCampaignPresetSelect"
        label="Create campaign"
        onCreate={createCampaign}
      />

      {selected ? (
        <div className="rounded-2xl border border-border/40 bg-background/20 p-4 text-xs text-muted-foreground">
          Selected: <span className="font-semibold text-foreground">{selected.name}</span>
        </div>
      ) : null}
    </div>
  );
}

