'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import MetaAdPreviewCard from '@/app/components/createAd/MetaAdPreviewCard';
import type { GroupModel } from '@/app/components/createAd/types';
import { PresetFieldPreviewCard } from '@/app/components/assistant/FieldPreviewCard';
import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { useUploader } from '@/app/hooks/useUploader';
import { waitForAssetsReady } from '@/lib/gallery/wait-for-assets-ready';
import type { WorkflowState } from '@/lib/chats/types';
import {
  buildCampaignObjectiveOptions,
  TRAFFIC_GOAL_OPTIONS,
} from '@/lib/chats/campaign-objective-rules';

import { AnalyzingCraftLoader } from '../AnalyzingCraftLoader';

export type ChatWidgetDispatch = (
  action: string,
  payload?: Record<string, unknown>,
  userMessage?: string,
) => Promise<void>;

export function MediaSourceWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { source: 'upload', label: 'Upload here' },
        { source: 'gallery', label: 'From gallery' },
        { source: 'bulk', label: 'Bulk upload' },
      ].map((o) => (
        <button
          key={o.source}
          type="button"
          onClick={() => void onAction('media.source', { source: o.source }, o.label)}
          className="rounded-full border border-border/50 bg-background/70 px-3.5 py-1.5 text-[13px] font-medium transition hover:border-primary/40"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MediaUploadWidget({
  companyId,
  onAction,
}: {
  companyId: string;
  sessionId?: string;
  onAction: ChatWidgetDispatch;
}) {
  const { files, uploadWithBulkId } = useUploader(companyId);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'analyzing'>('idle');

  const onPick = useCallback(
    async (picked: FileList | null) => {
      if (!picked?.length) return;
      setPhase('uploading');
      try {
        const selected = Array.from(picked);
        const { bulkUploadId, assetIds } = await uploadWithBulkId(selected, {
          bulkName: `Chat · ${new Date().toLocaleString()}`,
        });
        const videoIds = selected
          .map((f, i) => (f.type.startsWith('video/') ? assetIds[i] : null))
          .filter((x): x is string => Boolean(x));

        setPhase('processing');
        await waitForAssetsReady(videoIds);

        setPhase('analyzing');
        await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(bulkUploadId)}/analyze`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'content' }),
        });

        await onAction(
          'media.uploaded',
          { bulkUploadId, assetIds, label: `Uploaded ${selected.length} file(s)` },
          `Uploaded ${selected.length} file(s)`,
        );
      } catch (e) {
        console.error(e);
      } finally {
        setPhase('idle');
      }
    },
    [uploadWithBulkId, onAction],
  );

  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-2 text-[13px] font-medium transition hover:border-primary/40">
        <input
          type="file"
          className="sr-only"
          multiple
          accept="image/*,video/*"
          disabled={phase !== 'idle'}
          onChange={(e) => void onPick(e.target.files)}
        />
        {phase === 'idle' ? 'Select files' : phase}
      </label>
      {phase !== 'idle' ? <AnalyzingCraftLoader /> : null}
      {files.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">{files.length} file(s) in queue</p>
      ) : null}
    </div>
  );
}

export function MediaPickWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  const [bulks, setBulks] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/gallery/assets', { credentials: 'include' });
        const data = (await res.json()) as {
          assets?: Array<{ bulkUploadId?: string | null; bulkUpload?: { id: string; name: string } }>;
        };
        const map = new Map<string, { id: string; name: string; count: number }>();
        for (const a of data.assets ?? []) {
          const bid = a.bulkUploadId ?? a.bulkUpload?.id;
          if (!bid) continue;
          const cur = map.get(bid);
          if (cur) cur.count += 1;
          else map.set(bid, { id: bid, name: a.bulkUpload?.name ?? 'Folder', count: 1 });
        }
        setBulks([...map.values()].slice(0, 24));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="mt-2 text-xs text-muted-foreground">Loading gallery…</p>;

  return (
    <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
      {bulks.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() =>
            void onAction(
              'media.galleryPicked',
              { bulkUploadId: b.id, assetIds: [], bulkName: b.name },
              b.name,
            )
          }
          className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-left text-[13px] transition hover:border-primary/40"
        >
          <span className="font-medium">{b.name}</span>
          <span className="ml-2 text-[11px] text-muted-foreground">{b.count} assets</span>
        </button>
      ))}
    </div>
  );
}

export function ChoiceWidget({
  options,
  onPick,
}: {
  options: { value: string; label: string }[];
  onPick: (value: string, label: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value, o.label)}
          className="rounded-full border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:text-primary"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PixelQuestionWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  const [accountPixels, setAccountPixels] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'choose' | 'enter'>('choose');
  const [pixelId, setPixelId] = useState('');

  useEffect(() => {
    void fetch('/api/meta/pixels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { pixels?: Array<{ id: string; name: string }> }) => {
        setAccountPixels(d.pixels ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = (hasPixel: boolean, id?: string, label?: string) => {
    void onAction(
      'pixel.answered',
      { hasPixel, pixelId: id?.trim() || undefined },
      label,
    );
  };

  if (loading) {
    return <p className="mt-2 text-[13px] text-muted-foreground">Checking your Meta ad account…</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      {accountPixels.length > 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Found {accountPixels.length} pixel{accountPixels.length === 1 ? '' : 's'} on your ad
          account. Select one or enter another ID.
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          No pixels found on this ad account. You can enter a pixel ID manually or continue without
          one (Traffic / Engagement / Awareness only).
        </p>
      )}

      {accountPixels.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {accountPixels.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => submit(true, p.id, `Pixel: ${p.name}`)}
              className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-left text-[13px] transition hover:border-primary/50"
            >
              <span className="font-medium">{p.name}</span>
              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{p.id}</span>
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'enter' ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Meta Pixel ID"
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 font-mono text-[13px]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!pixelId.trim()}
              onClick={() => submit(true, pixelId, `Pixel ID: ${pixelId.trim()}`)}
              className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-40"
            >
              Use this pixel
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="rounded-full border border-border/50 px-3.5 py-1.5 text-[13px] text-muted-foreground"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('enter')}
            className="rounded-full border border-border/50 bg-background/60 px-3.5 py-1.5 text-[13px] font-medium hover:border-primary/50"
          >
            Enter pixel ID
          </button>
          <button
            type="button"
            onClick={() => submit(false, undefined, 'No pixel yet')}
            className="rounded-full border border-border/50 bg-background/60 px-3.5 py-1.5 text-[13px] font-medium hover:border-amber-500/40"
          >
            No pixel yet
          </button>
        </div>
      )}
    </div>
  );
}

export function CampaignObjectiveWidget({
  hasPixel,
  onAction,
}: {
  hasPixel: boolean;
  onAction: ChatWidgetDispatch;
}) {
  const options = buildCampaignObjectiveOptions(hasPixel);
  const [trafficPick, setTrafficPick] = useState(false);

  const pickObjective = (
    objective: string,
    userMessage: string,
    trafficOptimizationGoal?: string,
  ) => {
    void onAction(
      'campaign.objectivePicked',
      { objective, trafficOptimizationGoal },
      userMessage,
    );
  };

  if (trafficPick && !hasPixel) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-[12px] text-muted-foreground">
          Traffic campaign — pick an optimization goal (no pixel required):
        </p>
        <div className="flex flex-col gap-2">
          {TRAFFIC_GOAL_OPTIONS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() =>
                pickObjective('OUTCOME_TRAFFIC', `Traffic — ${g.label}`, g.value)
              }
              className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-left transition hover:border-primary/50"
            >
              <span className="text-[13px] font-medium">{g.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{g.hint}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTrafficPick(false)}
          className="text-[12px] text-muted-foreground underline"
        >
          Back to objectives
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          title={o.disabled ? o.disabledReason : undefined}
          onClick={() => {
            if (o.disabled) return;
            if (o.value === 'OUTCOME_TRAFFIC' && !hasPixel) {
              setTrafficPick(true);
              return;
            }
            pickObjective(o.value, o.label);
          }}
          className={[
            'rounded-lg border px-3 py-2.5 text-left transition',
            o.disabled
              ? 'cursor-not-allowed border-border/25 bg-muted/30 opacity-55'
              : 'border-border/40 bg-background/60 hover:border-primary/50',
          ].join(' ')}
        >
          <span className="text-[13px] font-medium">{o.label}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{o.description}</span>
          {o.disabled && o.disabledReason ? (
            <span className="mt-1.5 block text-[10px] leading-snug text-amber-700/90 dark:text-amber-400/90">
              {o.disabledReason}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function CampaignPickerWidget({
  onAction,
}: {
  onAction: ChatWidgetDispatch;
}) {
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void fetch('/api/meta/campaigns', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { campaigns?: Array<{ id: string; name: string }> }) =>
        setCampaigns(d.campaigns ?? []),
      );
  }, []);

  return (
    <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
      {campaigns.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() =>
            void onAction(
              'campaign.selected',
              { campaignId: c.id, campaignName: c.name },
              c.name,
            )
          }
          className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-left text-[13px] transition hover:border-primary/50"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function AdSetPickerWidget({
  campaignId,
  onAction,
}: {
  campaignId?: string;
  onAction: ChatWidgetDispatch;
}) {
  const [adsets, setAdsets] = useState<Array<{ id: string; name: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setAdsets([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    void fetch(`/api/meta/adsets?campaignId=${encodeURIComponent(campaignId)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d: { adSets?: Array<{ id: string; name: string }> }) => {
        setAdsets(d.adSets ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [campaignId]);

  if (!campaignId) {
    return (
      <p className="mt-2 text-[13px] text-muted-foreground">Select a campaign first.</p>
    );
  }

  if (!loaded) {
    return <p className="mt-2 text-[13px] text-muted-foreground">Loading ad sets…</p>;
  }

  if (adsets.length === 0) {
    return (
      <div className="mt-2 space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
        <p className="text-[13px] text-foreground">
          This campaign has no ad sets yet. Create one from a preset to continue.
        </p>
        <button
          type="button"
          onClick={() =>
            void onAction('adset.choice', { choice: 'new' }, 'Create ad set from preset')
          }
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
        >
          Create ad set from preset
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
      {adsets.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() =>
            void onAction(
              'adset.selected',
              { adSetId: a.id, adSetName: a.name },
              a.name,
            )
          }
          className="rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-left text-[13px] transition hover:border-primary/50"
        >
          {a.name}
        </button>
      ))}
    </div>
  );
}

export function StepNavWidget({
  options,
  onAction,
}: {
  options: Array<{ step: string; label: string }>;
  onAction: ChatWidgetDispatch;
}) {
  if (!options.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.step}
          type="button"
          onClick={() => void onAction('workflow.goBack', { step: o.step, label: o.label }, o.label)}
          className="rounded-full border border-border/50 bg-background/70 px-3.5 py-1.5 text-[12px] font-medium transition hover:border-primary/40"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PresetPreviewWidget({
  payload,
  onAction,
  target,
}: {
  payload: { campaign?: CampaignPreset | null; adset?: AdsetPreset | null; target?: string };
  onAction: ChatWidgetDispatch;
  target: 'campaign' | 'adset';
}) {
  return (
    <div className="mt-2">
      <PresetFieldPreviewCard
        campaign={payload.campaign ?? null}
        adset={payload.adset ?? null}
        previewTarget={target}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() =>
            void onAction(
              target === 'campaign' ? 'campaign.approved' : 'adset.approved',
              {},
              'Approve preset',
            )
          }
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
        >
          Approve preset
        </button>
      </div>
    </div>
  );
}

export function CreativeCsvWidget({
  groups,
  onAction,
}: {
  groups?: GroupModel[];
  onAction: ChatWidgetDispatch;
}) {
  const [csv, setCsv] = useState('');

  function parse() {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (k: string) => headers.indexOf(k);
    const rows: Array<{ bucketId: string; creative: Record<string, string> }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const groupKey = cols[idx('groupkey')] ?? cols[idx('bucketid')] ?? '';
      const bucket = groups?.find((g) => g.bucketId === groupKey || g.label === groupKey);
      if (!bucket) continue;
      rows.push({
        bucketId: bucket.bucketId,
        creative: {
          headline: cols[idx('headline')] ?? '',
          primaryText: cols[idx('primarytext')] ?? cols[idx('primary_text')] ?? '',
          landingUrl: cols[idx('landingurl')] ?? cols[idx('landing_url')] ?? '',
          ctaType: cols[idx('ctatype')] ?? 'LEARN_MORE',
        },
      });
    }
    void onAction('creative.csvParsed', { groups: rows }, 'Applied CSV copy');
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="groupKey,headline,primaryText,landingUrl,ctaType"
        rows={5}
        className="w-full rounded-lg border border-border/50 bg-background/50 p-2 text-xs"
      />
      <button type="button" onClick={parse} className="glass-button-primary rounded-lg px-3 py-1.5 text-xs">
        Apply CSV
      </button>
    </div>
  );
}

function logCreativeAi(phase: string, detail?: Record<string, unknown>) {
  if (detail) console.log(`[chats:creative-ai] ${phase}`, detail);
  else console.log(`[chats:creative-ai] ${phase}`);
}

export function CreativeAiWidget({
  sessionId,
  groups,
  workflowState,
  onAction,
}: {
  sessionId: string;
  groups?: GroupModel[];
  workflowState: WorkflowState;
  onAction: ChatWidgetDispatch;
}) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const hasCopy = groups?.some((g) => g.creative?.headline?.trim());
  const groupKey = (groups ?? [])
    .map((g) => `${g.bucketId}:${g.included ? 1 : 0}:${g.assetIds[0] ?? ''}`)
    .join('|');

  useEffect(() => {
    if (!sessionId || !groups?.length || hasCopy) {
      logCreativeAi('effect skip', {
        sessionId,
        groupCount: groups?.length ?? 0,
        hasCopy,
        reason: !sessionId ? 'no-session' : !groups?.length ? 'no-groups' : 'has-copy',
      });
      return;
    }

    let cancelled = false;
    const runId = `${sessionId}-${Date.now()}`;
    logCreativeAi('run started', {
      runId,
      sessionId,
      groupCount: groups.length,
      included: groups.filter((g) => g.included).length,
      groupKey,
    });

    void (async () => {
      setRunning(true);
      setError(null);
      try {
        const next = groups.map((g) => ({
          ...g,
          creative: { ...g.creative },
        }));
        const included = next.filter((x) => x.included);
        let suggested = 0;

        for (const g of included) {
          if (cancelled) {
            logCreativeAi('cancelled mid-loop', { runId, bucketId: g.bucketId });
            return;
          }
          const assetId = g.assetIds[0];
          if (!assetId) {
            logCreativeAi('skip group — no assetId', { runId, bucketId: g.bucketId, label: g.label });
            continue;
          }
          logCreativeAi('creative-suggest request', { runId, bucketId: g.bucketId, assetId });
          const res = await fetch('/api/assistant/creative-suggest', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetId,
              adType: workflowState.adType ?? 'OUTCOME_TRAFFIC',
              tone: workflowState.tone ?? 'general',
              groupLabel: g.label,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            logCreativeAi('creative-suggest failed', { runId, bucketId: g.bucketId, status: res.status, data });
            continue;
          }
          if (cancelled) return;
          g.creative = {
            ...g.creative,
            headline: data.headline ?? g.creative.headline,
            primaryText: data.primaryText ?? g.creative.primaryText,
            description: data.description ?? g.creative.description,
            landingUrl: data.landingUrl ?? g.creative.landingUrl,
            ctaType: data.ctaType ?? g.creative.ctaType,
            pixelId: g.creative.pixelId,
          };
          suggested += 1;
          logCreativeAi('creative-suggest ok', {
            runId,
            bucketId: g.bucketId,
            headline: g.creative.headline?.slice(0, 40),
          });
        }

        if (cancelled) {
          logCreativeAi('cancelled before aiDone', { runId, suggested });
          return;
        }

        logCreativeAi('creative.aiDone dispatch', { runId, suggested, total: included.length });
        await onActionRef.current('creative.aiDone', { groups: next });
        if (!cancelled) {
          setDone(true);
          logCreativeAi('run complete', { runId });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logCreativeAi('run error', { runId, error: msg });
        console.error('[chats:creative-ai]', e);
        if (!cancelled) setError(msg);
      } finally {
        setRunning(false);
      }
    })();

    return () => {
      cancelled = true;
      logCreativeAi('effect cleanup (will allow remount retry)', { runId });
    };
  }, [sessionId, groupKey, workflowState.adType, workflowState.tone, hasCopy]);

  if (hasCopy || done) return null;
  if (error) {
    return (
      <p className="text-[13px] text-destructive">
        Ad copy failed: {error}. Try again or upload a CSV.
      </p>
    );
  }
  if (running) return <AnalyzingCraftLoader />;
  return (
    <p className="text-[13px] text-muted-foreground">Preparing ad copy…</p>
  );
}

export function AdPreviewWidget({
  groups,
  onAction,
}: {
  groups?: GroupModel[];
  onAction: ChatWidgetDispatch;
}) {
  const included = useMemo(() => (groups ?? []).filter((g) => g.included), [groups]);

  return (
    <div className="mt-2 space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {included.map((g) => {
          const asset = g.assets[0];
          if (!asset) return null;
          return (
            <div key={g.bucketId} className="space-y-1">
              <p className="text-xs font-semibold text-foreground">{g.label}</p>
              <MetaAdPreviewCard creative={g.creative} asset={asset} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onAction('preview.approved', {}, 'Approve ads')}
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
        >
          Approve preview
        </button>
        <button
          type="button"
          onClick={() => void onAction('preview.changes', {}, 'Request changes')}
          className="rounded-lg border border-border/50 px-3 py-1.5 text-xs"
        >
          Request changes
        </button>
      </div>
    </div>
  );
}

export function PublishScheduleWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  const [scheduledAt, setScheduledAt] = useState('');

  return (
    <div className="mt-2 space-y-2">
      <input
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onAction('publish.submit', {}, 'Publish now')}
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
        >
          Post now
        </button>
        <button
          type="button"
          disabled={!scheduledAt}
          onClick={() =>
            void onAction(
              'publish.submit',
              {
                scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
              },
              'Schedule publish',
            )
          }
          className="rounded-lg border border-border/50 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Schedule
        </button>
      </div>
    </div>
  );
}

export function DoneWidget({ jobIds }: { jobIds?: string[] }) {
  return (
    <div className="mt-2">
      <Link href="/manager/history" className="text-sm font-medium text-clipfox-primary hover:underline">
        View Ad History →
      </Link>
      {jobIds?.length ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{jobIds.length} job(s) queued</p>
      ) : null}
    </div>
  );
}
