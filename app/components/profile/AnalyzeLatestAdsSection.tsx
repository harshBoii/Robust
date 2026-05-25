'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import AnalyzeIntelligenceResults from '@/app/components/profile/AnalyzeIntelligenceResults';
import { useToast } from '@/app/components/UI/ToastProvider';
import type { IntelligenceResultRow } from '@/lib/asset-intelligence/intelligence-results';
import type { TopWinningAsset } from '@/lib/asset-intelligence/types';

type StepState = 'idle' | 'pending' | 'active' | 'done' | 'error';

type Step = {
  state: StepState;
  label: string;
};

type LinkCreativesResponse = {
  linked: number;
  alreadyLinked: number;
  imported: number;
  noGalleryMatch: number;
  importFailed: number;
  readyForAnalysis: boolean;
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function StepDot({ state }: { state: StepState }) {
  if (state === 'done') {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />;
  }
  if (state === 'active') {
    return (
      <span
        className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary/70"
        aria-hidden
      />
    );
  }
  if (state === 'error') {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />;
  }
  return (
    <span className="h-2 w-2 shrink-0 rounded-full bg-black/15" aria-hidden />
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <li className="relative flex items-center gap-2.5 pb-4 last:pb-0">
      <StepDot state={step.state} />
      <span
        className={`font-body text-[12px] leading-snug ${
          step.state === 'done'
            ? 'text-foreground'
            : step.state === 'active'
              ? 'text-foreground'
              : step.state === 'error'
                ? 'text-red-600'
                : 'text-muted-foreground'
        }`}
      >
        {step.label}
      </span>
    </li>
  );
}

const POLL_MS = 3000;

const INITIAL_STEPS: Step[] = [
  { state: 'idle', label: 'Fetch from Meta and link to gallery' },
  { state: 'idle', label: 'Fetch winning Meta ads' },
  { state: 'idle', label: 'Send to Asset Intelligence' },
  { state: 'idle', label: 'Wait for analysis results' },
];

export default function AnalyzeLatestAdsSection() {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [assets, setAssets] = useState<TopWinningAsset[]>([]);
  const [results, setResults] = useState<IntelligenceResultRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);

  const loadResults = useCallback(async (assetIds?: string[]) => {
    setResultsLoading(true);
    try {
      const qs = assetIds?.length
        ? `?assetIds=${encodeURIComponent(assetIds.join(','))}`
        : '';
      const data = await json<{ results: IntelligenceResultRow[] }>(
        await fetch(`/api/ads/intelligence-results${qs}`, { credentials: 'include' }),
      );
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const setStep = (index: number, patch: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  };

  const pollIntelligenceStatus = useCallback(
    (assetIds: string[], total: number) => {
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const qs = new URLSearchParams({ assetIds: assetIds.join(',') });
          const data = await json<{ ready: number; total: number }>(
            await fetch(`/api/ads/intelligence-status?${qs}`, {
              credentials: 'include',
            }),
          );
          setStep(3, {
            state: 'active',
            label: `${data.ready}/${total} analyzed…`,
          });
          if (data.ready >= total) {
            clearPoll();
            setStep(3, { state: 'done', label: `${total}/${total} analyzed ✓` });
            setRunning(false);
            void loadResults(assetIds);
          }
        } catch {
          clearPoll();
          setStep(3, { state: 'error', label: 'Failed to check analysis status' });
          setRunning(false);
        }
      }, POLL_MS);
    },
    [clearPoll, loadResults],
  );

  const runPipeline = async () => {
    if (running) return;
    setExpanded(true);
    setRunning(true);
    setAssets([]);
    setSteps([
      { state: 'active', label: 'Fetching media from Meta and importing…' },
      { state: 'idle', label: 'Fetch video ads for analysis' },
      { state: 'idle', label: 'Send to Asset Intelligence' },
      { state: 'idle', label: 'Wait for analysis results' },
    ]);

    try {
      const link = await json<LinkCreativesResponse>(
        await fetch('/api/ads/link-winning-creatives', {
          method: 'POST',
          credentials: 'include',
        }),
      );

      const linkedTotal =
        link.linked + link.alreadyLinked + (link.imported ?? 0);
      const importNote =
        link.imported > 0 ? ` (${link.imported} imported from Meta)` : '';
      if (link.readyForAnalysis) {
        setStep(0, {
          state: 'done',
          label: `Linked ${linkedTotal} video ad(s) to gallery ✓${importNote}`,
        });
      } else {
        setStep(0, {
          state: 'done',
          label: `Linked ${linkedTotal} video ad(s) — some could not import`,
        });
        if (link.importFailed > 0 || link.noGalleryMatch > 0) {
          toast.push({
            title: 'Partial link',
            message:
              'Some video ads could not be imported from Meta (permissions, format, or missing source URL).',
            kind: 'info',
          });
        }
      }

      setStep(1, { state: 'active', label: 'Fetching video ads…' });

      const top = await json<{ assets: TopWinningAsset[] }>(
        await fetch('/api/ads/top-winning', { credentials: 'include' }),
      );
      const fetched = top.assets;
      setAssets(fetched);
      setStep(1, {
        state: 'done',
        label: `Fetched ${fetched.length} video ad${fetched.length === 1 ? '' : 's'} ✓`,
      });
      setStep(2, { state: 'active', label: 'Sending to Asset Intelligence…' });

      await json<{ jobIds: string[] }>(
        await fetch('/api/ads/analyze', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assets: fetched }),
        }),
      );

      setStep(2, { state: 'done', label: 'Sent to analysis ✓' });
      setStep(3, { state: 'active', label: `0/${fetched.length} analyzed…` });

      const ids = fetched.map((a) => a.assetId);
      pollIntelligenceStatus(ids, fetched.length);

      const qs = new URLSearchParams({ assetIds: ids.join(',') });
      const initial = await json<{ ready: number; total: number }>(
        await fetch(`/api/ads/intelligence-status?${qs}`, {
          credentials: 'include',
        }),
      );
      if (initial.ready >= initial.total) {
        clearPoll();
        setStep(3, {
          state: 'done',
          label: `${initial.total}/${initial.total} analyzed ✓`,
        });
        setRunning(false);
        void loadResults(ids);
      }
    } catch (e) {
      clearPoll();
      const message = e instanceof Error ? e.message : 'Analysis failed';
      toast.push({ title: 'Analysis failed', message, kind: 'error' });
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.state === 'active');
        const i = idx >= 0 ? idx : 0;
        return prev.map((s, j) =>
          j === i ? { ...s, state: 'error', label: message } : s,
        );
      });
      setRunning(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={() => void runPipeline()}
        disabled={running}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        Analyze Latest Ads
      </button>

      {expanded && (
        <div className="relative pl-1">
          <div
            className="absolute bottom-2 left-[3px] top-2 w-px bg-black/10"
            aria-hidden
          />
          <ol className="relative list-none pl-4" aria-label="Analysis progress">
            {steps.map((step, i) => (
              <StepRow key={i} step={step} />
            ))}
          </ol>
        </div>
      )}

      {assets.length > 0 && !running && steps[3]?.state === 'done' && (
        <p className="font-body text-[11px] text-muted-foreground">
          Intelligence saved for {assets.length} asset{assets.length === 1 ? '' : 's'}.
        </p>
      )}

      <AnalyzeIntelligenceResults results={results} loading={resultsLoading && !results.length} />
    </div>
  );
}
