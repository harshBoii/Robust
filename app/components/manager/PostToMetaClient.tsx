'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/app/components/UI/ToastProvider';

/* ─────────────────────────────────────────── types ── */
type Campaign  = { id: string; name: string; objective?: string; status?: string };
type AdSet     = { id: string; name: string; status?: string };
type Preset    = { id: string; name: string };
type AssetBucket = { id: string; label: string };
type Asset     = {
  id: string; title: string; thumbnailUrl: string | null;
  assetType: string; bulkUploadId: string | null; assetBucketId: string | null;
};
type JobRow    = { id: string; status: string; lastError?: string | null };
type GalleryAssetApiRow = {
  id: string; title: string; thumbnailUrl?: string | null;
  assetType: string; bulkUploadId?: string | null; assetBucketId?: string | null;
  bulkUpload?: { id: string; name: string } | null;
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data;
}

/* ─────────────────────────────────────── step config ── */
const STEPS = ['Campaign', 'Ad Set', 'Creatives', 'Preset', 'Publish'] as const;
type Step = (typeof STEPS)[number];

const STEP_META: Record<Step, { icon: React.ReactNode; description: string }> = {
  'Campaign': {
    description: 'Choose an existing campaign or create one from a preset.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <path d="M15 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7.5L15 3z" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="15 3 15 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="9" y1="13" x2="15" y2="13" strokeLinecap="round"/>
        <line x1="9" y1="17" x2="11" y2="17" strokeLinecap="round"/>
      </svg>
    ),
  },
  'Ad Set': {
    description: 'Pick an ad set within the selected campaign.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round"/>
        <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round"/>
        <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round"/>
        <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round"/>
      </svg>
    ),
  },
  'Creatives': {
    description: 'Select creative assets to publish in this ad set.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  'Preset': {
    description: 'Optionally apply a saved ad configuration.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" strokeLinecap="round"/>
      </svg>
    ),
  },
  'Publish': {
    description: 'Publish now or schedule for a future time.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
};

/* ─────────────────────────────── job status helpers ── */
const JOB_STATUS_STYLES: Record<string, string> = {
  PENDING:    'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  PROCESSING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  DONE:       'bg-clipfox-primary/10 text-clipfox-primary',
  ERROR:      'bg-destructive/10 text-destructive',
};
function jobStatusStyle(s: string) {
  return JOB_STATUS_STYLES[s.toUpperCase()] ?? 'bg-muted text-muted-foreground';
}

/* ──────────────────────── reusable sub-components ── */

/** Single selectable card used in Campaign / Ad Set lists */
function SelectCard({
  selected, onClick, title, sub,
}: { selected: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative rounded-2xl border p-4 text-left transition-all duration-200',
        selected
          ? 'border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/30'
          : 'border-border/50 bg-background/30 hover:border-border hover:bg-[var(--glass-hover)]',
      ].join(' ')}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      )}
      <p className="pr-6 text-sm font-medium text-foreground leading-snug">{title}</p>
      {sub && <p className="mt-1 font-ui text-[11px] text-muted-foreground">{sub}</p>}
    </button>
  );
}

/** "Create from preset" inline panel */
function CreateFromPreset({
  presets, selectId, label, onCreate,
}: {
  presets: Preset[];
  selectId: string;
  label: string;
  onCreate: (presetId: string) => Promise<void>;
}) {
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl border border-border/40 bg-background/20 p-4">
      <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Create from preset
      </p>
      {presets.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No presets available.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            id={selectId}
            className="glass-input flex-1 px-3 py-2 text-sm"
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
          >
            <option value="">Select a preset…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedPresetId || busy}
            onClick={async () => {
              if (!selectedPresetId) return;
              setBusy(true);
              try { await onCreate(selectedPresetId); } finally { setBusy(false); }
            }}
            className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
            {busy ? 'Creating…' : label}
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────── step progress bar ── */
function StepBar({ steps, current }: { steps: readonly Step[]; current: Step }) {
  const currentIdx = steps.indexOf(current);
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-0">
        {steps.map((s, i) => {
          const done    = i < currentIdx;
          const active  = s === current;
          const isLast  = i === steps.length - 1;
          return (
            <li key={s} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 text-xs font-semibold',
                    done   ? 'bg-primary text-white shadow-sm'
                    : active ? 'bg-primary/15 text-primary ring-2 ring-primary/40'
                    : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {done ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={[
                    'hidden whitespace-nowrap font-ui text-[10px] font-semibold uppercase tracking-widest sm:block',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {s}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    'mx-2 mb-4 h-px flex-1 transition-all duration-500',
                    i < currentIdx ? 'bg-primary/50' : 'bg-border/50',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ══════════════════════════════════ main component ══ */
export default function PostToMetaClient() {
  const toast = useToast();
  const [step, setStep] = useState<Step>('Campaign');

  const [campaigns, setCampaigns]           = useState<Campaign[]>([]);
  const [adSets, setAdSets]                 = useState<AdSet[]>([]);
  const [adPresets, setAdPresets]           = useState<Preset[]>([]);
  const [campaignPresets, setCampaignPresets] = useState<Preset[]>([]);
  const [adsetPresets, setAdsetPresets]     = useState<Preset[]>([]);

  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedAdSetId, setSelectedAdSetId]       = useState('');
  const [selectedAdPresetId, setSelectedAdPresetId] = useState('');

  const [bulkUploads, setBulkUploads]     = useState<{ id: string; name: string }[]>([]);
  const [activeBulkUploadId, setActiveBulkUploadId] = useState('');
  const [buckets, setBuckets]             = useState<AssetBucket[]>([]);
  const [activeBucketId, setActiveBucketId] = useState('');
  const [assets, setAssets]               = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

  const [scheduledAt, setScheduledAt]     = useState('');
  const [jobIds, setJobIds]               = useState<string[]>([]);
  const [jobRows, setJobRows]             = useState<JobRow[]>([]);

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  /* ── derived ── */
  const stepIndex = STEPS.indexOf(step);

  const canNext = useMemo(() => {
    if (step === 'Campaign')  return Boolean(selectedCampaignId);
    if (step === 'Ad Set')    return Boolean(selectedAdSetId);
    if (step === 'Creatives') return selectedAssetIds.size > 0;
    return true;
  }, [step, selectedCampaignId, selectedAdSetId, selectedAssetIds]);

  const next = useCallback(() => {
    if (!canNext) return;
    setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]);
  }, [canNext, stepIndex]);

  const prev = useCallback(() => {
    setStep(STEPS[Math.max(0, stepIndex - 1)]);
  }, [stepIndex]);

  /* ── load base lists ── */
  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null);
      try {
        const [c, pAd, pC, pAs] = await Promise.all([
          json<{ campaigns: Campaign[] }>(await fetch('/api/meta/campaigns', { credentials: 'include' })),
          json<{ presets: Preset[] }>(await fetch('/api/presets/ad', { credentials: 'include' })),
          json<{ presets: Preset[] }>(await fetch('/api/presets/campaign', { credentials: 'include' })),
          json<{ presets: Preset[] }>(await fetch('/api/presets/adset', { credentials: 'include' })),
        ]);
        setCampaigns(c.campaigns ?? []);
        setAdPresets(pAd.presets ?? []);
        setCampaignPresets(pC.presets ?? []);
        setAdsetPresets(pAs.presets ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── load ad sets when campaign selected ── */
  useEffect(() => {
    if (!selectedCampaignId) return;
    void (async () => {
      try {
        const data = await json<{ adSets: AdSet[] }>(
          await fetch(`/api/meta/adsets?campaignId=${encodeURIComponent(selectedCampaignId)}`, { credentials: 'include' }),
        );
        setAdSets(data.adSets ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load ad sets');
      }
    })();
  }, [selectedCampaignId]);

  /* ── load assets for creatives step ── */
  useEffect(() => {
    if (step !== 'Creatives') return;
    void (async () => {
      try {
        const resp = await json<{ assets: GalleryAssetApiRow[] }>(
          await fetch('/api/gallery/assets', { credentials: 'include' }),
        );
        const a: Asset[] = (resp.assets ?? []).map((x) => ({
          id: x.id, title: x.title,
          thumbnailUrl: x.thumbnailUrl ?? null,
          assetType: x.assetType,
          bulkUploadId: x.bulkUploadId ?? null,
          assetBucketId: x.assetBucketId ?? null,
        }));
        setAssets(a);
        const bulks = new Map<string, string>();
        for (const x of resp.assets ?? []) {
          if (x.bulkUpload?.id && x.bulkUpload?.name) bulks.set(x.bulkUpload.id, x.bulkUpload.name);
        }
        setBulkUploads([...bulks.entries()].map(([id, name]) => ({ id, name })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load creatives');
      }
    })();
  }, [step]);

  /* ── derive buckets ── */
  useEffect(() => {
    if (!activeBulkUploadId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBuckets([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveBucketId('');
      return;
    }
    const m = new Map<string, string>();
    for (const a of assets) {
      if (a.bulkUploadId !== activeBulkUploadId || !a.assetBucketId) continue;
      m.set(a.assetBucketId, a.assetBucketId);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuckets([...m.entries()].map(([id, label]) => ({ id, label })));
  }, [activeBulkUploadId, assets]);

  const visibleAssets = useMemo(() => assets.filter((a) => {
    if (activeBulkUploadId && a.bulkUploadId !== activeBulkUploadId) return false;
    if (activeBucketId     && a.assetBucketId !== activeBucketId)    return false;
    return true;
  }), [assets, activeBulkUploadId, activeBucketId]);

  const toggleAsset = useCallback((id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* ── publish ── */
  const publish = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const resp = await json<{ jobIds: string[] }>(
        await fetch('/api/meta/publish', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: selectedCampaignId,
            adSetId: selectedAdSetId,
            assetIds: [...selectedAssetIds],
            adPresetId: selectedAdPresetId || undefined,
            scheduledAt: scheduledAt || undefined,
          }),
        }),
      );
      setJobIds(resp.jobIds ?? []);
      toast.push({
        kind: 'success',
        title: scheduledAt ? 'Ads scheduled' : 'Ads queued',
        message: `${(resp.jobIds ?? []).length} job(s) created`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Publish failed';
      setError(msg);
      toast.push({ kind: 'error', title: 'Publish failed', message: msg });
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId, selectedAdSetId, selectedAssetIds, selectedAdPresetId, scheduledAt, toast]);

  /* ── SSE job tracking ── */
  useEffect(() => {
    if (!jobIds.length) return;
    let aborted = false;
    const ctrl = new AbortController();
    const qs = `ids=${encodeURIComponent(jobIds.join(','))}`;
    void (async () => {
      try {
        const res = await fetch(`/api/meta/publish/jobs?${qs}`, { method: 'POST', signal: ctrl.signal });
        if (!res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const p of parts) {
            const line = p.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as { jobs?: JobRow[]; done?: boolean };
            if (payload.jobs) setJobRows(payload.jobs);
            if (payload.done) return;
          }
        }
      } catch { /* ignored */ }
    })();
    return () => { aborted = true; ctrl.abort(); };
  }, [jobIds]);

  /* ── campaign create helper ── */
  const createCampaign = useCallback(async (presetId: string) => {
    setError(null);
    const data = await json<{ campaign: Campaign }>(
      await fetch('/api/meta/campaigns', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId }),
      }),
    );
    setCampaigns((prev) => [data.campaign, ...prev]);
    setSelectedCampaignId(data.campaign.id);
  }, []);

  /* ── adset create helper ── */
  const createAdSet = useCallback(async (presetId: string) => {
    if (!selectedCampaignId) return;
    setError(null);
    const data = await json<{ adSet: AdSet }>(
      await fetch('/api/meta/adsets', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId, campaignId: selectedCampaignId }),
      }),
    );
    setAdSets((prev) => [data.adSet, ...prev]);
    setSelectedAdSetId(data.adSet.id);
  }, [selectedCampaignId]);

  /* ── summary bar data ── */
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const selectedAdSet    = adSets.find((a) => a.id === selectedAdSetId);

  /* ──────────────────────────────────────── render ── */
  return (
    <div className="mx-auto max-w-4xl space-y-0">

      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-clipfox-primary/15 text-clipfox-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Meta Ads
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Post to Meta</h1>
          <p className="text-sm text-muted-foreground">
            Walk through each step to publish or schedule your ads.
          </p>
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={stepIndex === 0}
            className="glass-button flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canNext || stepIndex >= STEPS.length - 1}
            className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Step Progress Bar ── */}
      <div className="glass-card px-6 py-5">
        <StepBar steps={STEPS} current={step} />
      </div>

      {/* ── Selection Summary Bar ── */}
      {(selectedCampaign || selectedAdSet || selectedAssetIds.size > 0) && (
        <div className="animate-fade-up mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-background/30 px-4 py-2.5">
          <span className="font-ui text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Selected
          </span>
          {selectedCampaign && (
            <span className="glass-badge border-primary/20 bg-primary/8 text-primary">
              {selectedCampaign.name}
            </span>
          )}
          {selectedAdSet && (
            <span className="glass-badge border-clipfox-accent/20 bg-clipfox-accent/8 text-clipfox-accent">
              {selectedAdSet.name}
            </span>
          )}
          {selectedAssetIds.size > 0 && (
            <span className="glass-badge border-border/50 bg-muted text-muted-foreground">
              {selectedAssetIds.size} creative{selectedAssetIds.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="animate-fade-up mt-3 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Step Card ── */}
      <div className="glass-card mt-3 overflow-hidden">

        {/* Step card header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {STEP_META[step].icon}
          </div>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">{step}</h2>
            <p className="font-ui text-xs text-muted-foreground">{STEP_META[step].description}</p>
          </div>
          {loading && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Loading…
            </div>
          )}
        </div>

        <div className="p-6">

          {/* ══ Campaign step ══ */}
          {step === 'Campaign' && (
            <div className="space-y-4">
              {campaigns.length === 0 && !loading ? (
                <EmptyState icon="folder" message="No campaigns found." sub="Create one from a preset below." />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {campaigns.map((c) => (
                    <SelectCard
                      key={c.id}
                      selected={selectedCampaignId === c.id}
                      onClick={() => setSelectedCampaignId(c.id)}
                      title={c.name}
                      sub={[c.objective, c.status].filter(Boolean).join(' · ') || undefined}
                    />
                  ))}
                </div>
              )}
              <CreateFromPreset
                presets={campaignPresets}
                selectId="campaignPresetSelect"
                label="Create campaign"
                onCreate={createCampaign}
              />
            </div>
          )}

          {/* ══ Ad Set step ══ */}
          {step === 'Ad Set' && (
            <div className="space-y-4">
              {!selectedCampaignId ? (
                <EmptyState icon="alert" message="No campaign selected." sub="Go back and pick a campaign first." />
              ) : adSets.length === 0 && !loading ? (
                <EmptyState icon="folder" message="No ad sets in this campaign." sub="Create one from a preset below." />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {adSets.map((a) => (
                    <SelectCard
                      key={a.id}
                      selected={selectedAdSetId === a.id}
                      onClick={() => setSelectedAdSetId(a.id)}
                      title={a.name}
                      sub={a.status ?? undefined}
                    />
                  ))}
                </div>
              )}
              <CreateFromPreset
                presets={adsetPresets}
                selectId="adsetPresetSelect"
                label="Create ad set"
                onCreate={createAdSet}
              />
            </div>
          )}

          {/* ══ Creatives step ══ */}
          {step === 'Creatives' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="glass-input flex-1 px-3 py-2 text-sm"
                  value={activeBulkUploadId}
                  onChange={(e) => setActiveBulkUploadId(e.target.value)}
                >
                  <option value="">All folders</option>
                  {bulkUploads.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select
                  className="glass-input flex-1 px-3 py-2 text-sm"
                  value={activeBucketId}
                  onChange={(e) => setActiveBucketId(e.target.value)}
                  disabled={!buckets.length}
                >
                  <option value="">All classifications</option>
                  {buckets.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                {selectedAssetIds.size > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="glass-badge border-primary/20 bg-primary/8 text-primary">
                      {selectedAssetIds.size} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedAssetIds(new Set())}
                      className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Asset grid */}
              {visibleAssets.length === 0 && !loading ? (
                <EmptyState icon="image" message="No assets found." sub="Try a different folder or upload assets first." />
              ) : (
                <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                  {visibleAssets.map((a) => {
                    const selected = selectedAssetIds.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAsset(a.id)}
                        className={[
                          'group relative overflow-hidden rounded-2xl border text-left transition-all duration-200',
                          selected
                            ? 'border-primary/50 shadow-sm ring-1 ring-primary/30'
                            : 'border-border/40 hover:border-border',
                        ].join(' ')}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square w-full overflow-hidden bg-muted">
                          {a.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.thumbnailUrl}
                              alt={a.title}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Check overlay */}
                        {selected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-md">
                              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          </div>
                        )}
                        {/* Meta */}
                        <div className="p-2">
                          <p className="truncate font-ui text-[11px] font-medium leading-tight text-foreground">{a.title}</p>
                          <p className="font-ui text-[10px] uppercase tracking-wide text-muted-foreground">{a.assetType}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ Preset step ══ */}
          {step === 'Preset' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label htmlFor="adPreset" className="font-ui mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Ad Preset <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
                </label>
                <select
                  id="adPreset"
                  className="glass-input w-full px-3 py-2.5 text-sm"
                  value={selectedAdPresetId}
                  onChange={(e) => setSelectedAdPresetId(e.target.value)}
                >
                  <option value="">No preset — use defaults</option>
                  {adPresets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="rounded-2xl border border-border/40 bg-background/20 p-4 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">What does a preset do?</p>
                Presets carry saved values for headline, landing URL, targeting, and pixel
                settings. The creative media always comes from the assets you selected in the
                previous step — presets never override that.
              </div>
            </div>
          )}

          {/* ══ Publish step ══ */}
          {step === 'Publish' && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Campaign',  value: selectedCampaign?.name  ?? '—' },
                  { label: 'Ad Set',    value: selectedAdSet?.name     ?? '—' },
                  { label: 'Creatives', value: `${selectedAssetIds.size} asset${selectedAssetIds.size !== 1 ? 's' : ''}` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-border/40 bg-background/20 px-4 py-3">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* Schedule + publish */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="scheduleAt" className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Schedule <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    id="scheduleAt"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="glass-input px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={publish}
                  disabled={loading || selectedAssetIds.size === 0}
                  className="glass-button-primary flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {loading ? 'Publishing…' : scheduledAt ? 'Schedule ads' : 'Publish now'}
                </button>
              </div>

              {/* Job tracker */}
              {jobIds.length > 0 && (
                <div className="animate-fade-up rounded-2xl border border-border/40 bg-background/20 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                    <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Job tracker
                    </p>
                    <span className="glass-badge">{jobIds.length} job{jobIds.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-border/30">
                    {jobRows.length ? jobRows.map((j) => (
                      <div key={j.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                        <span className="font-data text-[11px] text-muted-foreground truncate">{j.id}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={[
                            'rounded-full px-2.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wide',
                            jobStatusStyle(j.status),
                          ].join(' ')}>
                            {j.status}
                          </span>
                          {j.lastError && (
                            <span className="text-[11px] text-destructive truncate max-w-[180px]" title={j.lastError}>
                              {j.lastError}
                            </span>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                        </svg>
                        Waiting for job updates…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Card Footer nav ── */}
        <div className="flex items-center justify-between border-t border-border/40 px-6 py-4">
          <button
            type="button"
            onClick={prev}
            disabled={stepIndex === 0}
            className="glass-button flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>

          <span className="font-ui text-[11px] text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </span>

          {step !== 'Publish' ? (
            <button
              type="button"
              onClick={next}
              disabled={!canNext}
              className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
            >
              Continue
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={publish}
              disabled={loading || selectedAssetIds.size === 0}
              className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {scheduledAt ? 'Schedule' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── helper: empty state ── */
function EmptyState({ icon, message, sub }: { icon: 'folder' | 'alert' | 'image'; message: string; sub?: string }) {
  const icons = {
    folder: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round"/>
      </svg>
    ),
    alert: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    image: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  };
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <span className="opacity-30">{icons[icon]}</span>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {sub && <p className="text-xs">{sub}</p>}
    </div>
  );
}