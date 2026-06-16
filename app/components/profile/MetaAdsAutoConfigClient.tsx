'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, Sparkles } from 'lucide-react';

import { ProfileSecondaryNav } from '@/app/components/profile/ProfileSecondaryNav';

import {
  profileCard,
  profileCardHeaderCompact,
  profileGhostButton,
  profilePageShell,
} from '@/app/components/profile/profile-utils';
import {
  IMAGE_ARTISTS,
  type ImageArtistId,
} from '@/lib/image-gen/image-artists';
import {
  DEFAULT_META_ADS_AUTO_CONFIG,
  type MetaAdsAutoConfigData,
  type MetaAdsMediaMode,
} from '@/lib/meta-ads-auto/defaults';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-border/40 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
    </label>
  );
}

export default function MetaAdsAutoConfigClient() {
  const [config, setConfig] = useState<MetaAdsAutoConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<{ config: MetaAdsAutoConfigData }>(
        await fetch('/api/meta-ads-auto/config', { credentials: 'include' }),
      );
      setConfig(data.config);
    } catch (e) {
      setConfig({ ...DEFAULT_META_ADS_AUTO_CONFIG });
      setError(
        e instanceof Error
          ? `${e.message} Showing defaults until settings can be saved.`
          : 'Could not load settings — showing defaults.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await json<{ config: MetaAdsAutoConfigData }>(
        await fetch('/api/meta-ads-auto/config', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        }),
      );
      setConfig(data.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const patch = (partial: Partial<MetaAdsAutoConfigData>) => {
    setConfig((c) => (c ? { ...c, ...partial } : c));
  };

  if (loading) {
    return (
      <div className={`${profilePageShell} flex items-center justify-center py-20`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className={profilePageShell}>
        <p className="text-sm text-muted-foreground">Loading Ads Automation…</p>
      </div>
    );
  }

  return (
    <div className={profilePageShell}>
      <div className={`${profileCard} mb-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">Ads Automation</h1>
            <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
              Configure auto mode for Miss Robusta — generate statics, pick campaigns, and draft or
              publish ads without manual widget steps.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className={`${profileGhostButton} font-semibold disabled:opacity-60`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? 'Saved' : 'Save changes'}
          </button>
        </div>
        <div className="border-t border-border px-3 py-2">
          <ProfileSecondaryNav />
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={profileCard}>
          <div className={profileCardHeaderCompact}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <h2 className="font-display text-[13px] font-semibold">Auto mode defaults</h2>
            </div>
          </div>
          <div className="px-3 py-1">
            <ToggleRow
              label="Auto mode default"
              description="New ad chats start with auto mode enabled."
              checked={config.autoModeDefault}
              onChange={(v) => patch({ autoModeDefault: v })}
            />
            <ToggleRow
              label="Auto post to Meta"
              description="Publish immediately when pipeline completes. Off saves ads to Pending."
              checked={config.autoPost}
              onChange={(v) => patch({ autoPost: v })}
            />
          </div>
        </div>

        <div className={profileCard}>
          <div className={profileCardHeaderCompact}>
            <div className="flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-primary" />
              <h2 className="font-display text-[13px] font-semibold">Permissions</h2>
            </div>
          </div>
          <div className="px-3 py-1">
            <ToggleRow
              label="New campaign creation"
              checked={config.allowNewCampaign}
              onChange={(v) => patch({ allowNewCampaign: v })}
            />
            <ToggleRow
              label="New ad set creation"
              checked={config.allowNewAdset}
              onChange={(v) => patch({ allowNewAdset: v })}
            />
            <ToggleRow
              label="New ad static generation"
              checked={config.allowStaticGeneration}
              onChange={(v) => patch({ allowStaticGeneration: v })}
            />
          </div>
        </div>

        <div className={`${profileCard} lg:col-span-2`}>
          <div className={profileCardHeaderCompact}>
            <h2 className="font-display text-[13px] font-semibold">Media & creative</h2>
          </div>
          <div className="space-y-4 px-3 py-3">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground">Media source</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ['auto_generate', 'Auto-generate statics'],
                    ['manual_selection', 'Ask for manual media selection'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patch({ mediaMode: value as MetaAdsMediaMode })}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                      config.mediaMode === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="default-artist"
                className="text-[12px] font-medium text-muted-foreground"
              >
                Default artist
              </label>
              <select
                id="default-artist"
                value={config.defaultArtistId}
                onChange={(e) => patch({ defaultArtistId: e.target.value as ImageArtistId })}
                className="mt-1.5 w-full max-w-sm rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
              >
                {IMAGE_ARTISTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.tagline}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="default-budget"
                  className="text-[12px] font-medium text-muted-foreground"
                >
                  Default daily budget (paise/cents)
                </label>
                <input
                  id="default-budget"
                  type="number"
                  min={0}
                  value={config.defaultDailyBudget ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    patch({ defaultDailyBudget: v ? Number(v) : null });
                  }}
                  placeholder="e.g. 2000"
                  className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label
                  htmlFor="default-objective"
                  className="text-[12px] font-medium text-muted-foreground"
                >
                  Default objective (optional)
                </label>
                <input
                  id="default-objective"
                  type="text"
                  value={config.defaultObjective ?? ''}
                  onChange={(e) =>
                    patch({ defaultObjective: e.target.value.trim() || null })
                  }
                  placeholder="OUTCOME_TRAFFIC"
                  className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link href="/manager/pending" className={profileGhostButton}>
          View pending ads
        </Link>
      </div>
    </div>
  );
}
