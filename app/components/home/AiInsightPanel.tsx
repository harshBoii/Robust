'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import FormattedInsightText from '@/app/components/home/FormattedInsightText';
import { buildAssistantContext } from '@/lib/dashboard/assistant-context';

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.08] to-transparent shadow-[var(--glass-shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

type AiInsightPanelProps = {
  rows: DashboardRow[];
  dashboardLoading: boolean;
};

function rowsCacheKey(rows: DashboardRow[]) {
  return rows
    .map((r) => `${r.adId}:${r.spendToday}:${r.statusSignal}:${r.status}`)
    .join('|');
}

export default function AiInsightPanel({ rows, dashboardLoading }: AiInsightPanelProps) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchKey = useRef('');

  useEffect(() => {
    if (dashboardLoading) return;

    if (!rows.length) {
      setBullets([]);
      setError(null);
      lastFetchKey.current = '';
      return;
    }

    const key = rowsCacheKey(rows);
    if (key === lastFetchKey.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch('/api/assistant/quick-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: buildAssistantContext(rows) }),
        });
        const data = (await res.json()) as { bullets?: string[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Failed to load insight');
        if (cancelled) return;
        lastFetchKey.current = key;
        setBullets(data.bullets ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not load insight');
        setBullets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, dashboardLoading]);

  return (
    <Panel className="mt-auto flex min-h-0 shrink-0 flex-col p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-violet-500/15">
          <Image src="/mascot/Robust.png" alt="Miss Robusta" fill className="object-cover" sizes="28px" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold">AI Insight</h3>
          <p className="text-[10px] text-muted-foreground">Miss Robusta</p>
        </div>
        {loading && <AiOutlineLoading className="h-4 w-4 shrink-0 animate-spin text-violet-600" />}
      </div>

      <div className="min-h-[4.5rem] flex-1">
        {dashboardLoading || loading ? (
          <p className="text-[11px] text-muted-foreground">Asking Miss Robusta for a quick insight…</p>
        ) : error ? (
          <p className="text-[11px] text-destructive">{error}</p>
        ) : !rows.length ? (
          <p className="text-[11px] text-muted-foreground">
            Refresh your dashboard to load ads, then Miss Robusta will summarize what matters.
          </p>
        ) : bullets.length > 0 ? (
          <ul className="space-y-2">
            {bullets.map((point, i) => (
              <li
                key={`${i}-${point.slice(0, 24)}`}
                className="flex gap-2.5 rounded-xl border border-violet-500/10 bg-violet-500/[0.04] px-2.5 py-2"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-ui text-[9px] font-bold text-violet-700 dark:text-violet-300"
                >
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/90">
                  <FormattedInsightText text={point} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">No insight available yet.</p>
        )}
      </div>

      <Link
        href="/report"
        className="mt-2.5 block w-full rounded-xl bg-violet-600 py-2 text-center text-xs font-semibold text-white transition hover:bg-violet-700"
      >
        View full report
      </Link>
    </Panel>
  );
}
