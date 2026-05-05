'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import AdPerformanceTable, {
  type DashboardRow,
} from '@/app/components/dashboard/AdPerformanceTable';
import AutomationControls, {
  type AutomationRule,
} from '@/app/components/dashboard/AutomationControls';
import SmartAssistant, {
  type AssistantRow,
  type Rule as AssistantRule,
} from '@/app/components/dashboard/SmartAssistant';
import DashboardCharts from '@/app/components/dashboard/DashboardCharts';
import { CURRENCIES, type Currency } from '@/lib/currency';

type DashboardGetResponse = {
  rules: AutomationRule[];
  metrics?: Array<{
    metaAdId: string;
    spend: number;
    ctr: number;
    statusSignal: string | null;
    datePreset: string;
    recordedAt: string;
  }>;
};

type RefreshResponse = { rows: DashboardRow[] };

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export default function DashboardClient() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [metrics, setMetrics] = useState<DashboardGetResponse['metrics']>([]);
  const [busyAdIds, setBusyAdIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('INR');

  const loadDashboardCache = useCallback(async () => {
    const data = await json<DashboardGetResponse>(await fetch('/api/dashboard'));
    setRules(data.rules ?? []);
    setMetrics(data.metrics ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const seeded = await json<{ rules: AutomationRule[] }>(
        await fetch('/api/dashboard/automation', { method: 'POST' }),
      );
      setRules(seeded.rules);
      const data = await json<RefreshResponse>(
        await fetch('/api/dashboard/refresh', { method: 'POST' }),
      );
      setRows(data.rows ?? []);
      await loadDashboardCache();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [loadDashboardCache]);

  useEffect(() => {
    void (async () => {
      try { await loadDashboardCache(); } catch { /* ignored */ }
      await refresh();
    })();
  }, [loadDashboardCache, refresh]);

  const toggleStatus = useCallback(async (adId: string, nextStatus: 'ACTIVE' | 'PAUSED') => {
    setBusyAdIds((prev) => new Set(prev).add(adId));
    setError(null);
    try {
      await json<{ ok: true }>(
        await fetch(`/api/meta/ads/${adId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }),
      );
      setRows((prev) => prev.map((r) => (r.adId === adId ? { ...r, status: nextStatus } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle ad');
    } finally {
      setBusyAdIds((prev) => { const next = new Set(prev); next.delete(adId); return next; });
    }
  }, []);

  const autoPause = useCallback(() => {
    const rule = rules.find((r) => r.ruleType === 'AUTO_PAUSE');
    if (!rule?.isEnabled || typeof rule.threshold !== 'number') return;
    const offenders = rows
      .filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE')
      .filter((r) => typeof r.cpi === 'number' && r.cpi > rule.threshold!);
    void (async () => { for (const r of offenders) await toggleStatus(r.adId, 'PAUSED'); })();
  }, [rows, rules, toggleStatus]);

  const updateRule = useCallback(
    async (
      ruleType: AutomationRule['ruleType'],
      patch: { isEnabled?: boolean; threshold?: number | null },
    ) => {
      setRules((prev) => prev.map((r) => (r.ruleType === ruleType ? { ...r, ...patch } : r)));
      try {
        await json<{ rule: AutomationRule }>(
          await fetch(`/api/dashboard/automation/${ruleType}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update rule');
      }
    },
    [],
  );

  const assistantRows: AssistantRow[] = useMemo(
    () => rows.map((r) => ({
      adId: r.adId, name: r.name, status: r.status,
      spendToday: r.spendToday, spendTotal: r.spendTotal,
      cpi: r.cpi ?? null, ctr: r.ctr ?? 0, hookRate: r.hookRate ?? null,
    })),
    [rows],
  );

  const assistantRules: AssistantRule[] = useMemo(
    () => rules.map((r) => ({
      ruleType: r.ruleType, isEnabled: r.isEnabled,
      threshold: r.threshold, window: r.window, requiresApproval: r.requiresApproval,
    })),
    [rules],
  );

  return (
    <div className="min-h-screen space-y-6 px-1 py-2">

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-clipfox-primary ring-2 ring-clipfox-primary/25" aria-hidden />
            <span className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Meta Ads
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Live snapshot of your Meta ads — spend, signals &amp; next-step suggestions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Currency toggle */}
          <div className="flex items-center rounded-xl border border-border/50 bg-background/40 p-0.5 backdrop-blur-sm">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCurrency(c.value)}
                className={[
                  'rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                  currency === c.value
                    ? 'glass-button-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {c.sym} {c.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className={[
              'glass-button-primary px-5 py-2 text-sm font-semibold',
              loading ? 'opacity-70' : '',
            ].join(' ')}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <AiOutlineLoading className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Refreshing…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Refresh
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:bg-destructive/10">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Charts ── */}
      <DashboardCharts metrics={metrics ?? []} currency={currency} />

      {/* ── Ad Performance Table ── */}
      <AdPerformanceTable
        rows={rows}
        onToggleStatus={toggleStatus}
        onAutoPause={autoPause}
        busyAdIds={busyAdIds}
        currency={currency}
      />

      {/* ── Smart Assistant (floating) ── */}
      <SmartAssistant
        rows={assistantRows}
        rules={assistantRules}
        onPauseAd={(adId) => toggleStatus(adId, 'PAUSED')}
        onRefresh={refresh}
      />
    </div>
  );
}