'use client';

import { useMemo } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import AdPerformanceTable from '@/app/components/dashboard/AdPerformanceTable';
import SmartAssistant, {
  type AssistantRow,
  type Rule as AssistantRule,
} from '@/app/components/dashboard/SmartAssistant';
import DashboardCharts from '@/app/components/dashboard/DashboardCharts';
import { CURRENCIES } from '@/lib/currency';
import { useDashboardData } from '@/lib/dashboard/client';

export default function DashboardClient() {
  const {
    rows,
    rules,
    metrics,
    busyAdIds,
    loading,
    error,
    currency,
    setCurrency,
    refresh,
    toggleStatus,
    autoPause,
  } = useDashboardData();

  const assistantRows: AssistantRow[] = useMemo(
    () =>
      rows.map((r) => ({
        adId: r.adId,
        name: r.name,
        status: r.status,
        spendToday: r.spendToday,
        spendTotal: r.spendTotal,
        cpi: r.cpi ?? null,
        ctr: r.ctr ?? 0,
        hookRate: r.hookRate ?? null,
      })),
    [rows],
  );

  const assistantRules: AssistantRule[] = useMemo(
    () =>
      rules.map((r) => ({
        ruleType: r.ruleType,
        isEnabled: r.isEnabled,
        threshold: r.threshold,
        window: r.window,
        requiresApproval: r.requiresApproval,
      })),
    [rules],
  );

  return (
    <div className="min-h-screen space-y-6 px-1 py-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-clipfox-primary ring-2 ring-clipfox-primary/25" aria-hidden />
            <span className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Meta Ads
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live snapshot of your Meta ads — spend, signals &amp; next-step suggestions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            className={['glass-button-primary px-5 py-2 text-sm font-semibold', loading ? 'opacity-70' : ''].join(' ')}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <AiOutlineLoading className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Refreshing…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Refresh
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive dark:bg-destructive/10">
          <span>{error}</span>
        </div>
      )}

      <DashboardCharts metrics={metrics} currency={currency} />

      <AdPerformanceTable
        rows={rows}
        onToggleStatus={toggleStatus}
        onAutoPause={autoPause}
        busyAdIds={busyAdIds}
        currency={currency}
      />

      <SmartAssistant
        rows={assistantRows}
        rules={assistantRules}
        onPauseAd={(adId) => toggleStatus(adId, 'PAUSED')}
        onRefresh={refresh}
      />
    </div>
  );
}
