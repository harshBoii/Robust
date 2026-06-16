'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import Link from 'next/link';
import { ChevronDown, RefreshCw, TriangleAlert } from 'lucide-react';
import { AiOutlineLoading } from 'react-icons/ai';

import AdPerformanceTable, { type DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import AiInsightPanel from '@/app/components/home/AiInsightPanel';
import { DateRangePicker } from '@/app/components/common/DateRangePicker';
import { CURRENCIES, convertFromInr } from '@/lib/currency';
import { useDashboardData } from '@/lib/dashboard/client';
import { bucketMetricsByDay, formatChartDayLabel } from '@/lib/dashboard/metrics';
import { computeHomeKpis, computeSignalMix, spendSeriesFromRows } from '@/lib/dashboard/stats';
import {
  defaultDateRange,
  filterMetricsByDateRange,
  filterRowsByDateRange,
  type DateRangeValue,
} from '@/lib/date-range';

type HomeOverviewClientProps = {
  displayName: string;
};

function MiniSparkline({ color, data }: { color: string; data: number[] }) {
  const chartData = useMemo(() => data.map((v, i) => ({ i, v })), [data]);
  if (!data.length) return null;
  return (
    <div className="h-6 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg-solid)] shadow-[var(--glass-shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  hintClass,
  sparkColor,
  sparkData,
}: {
  label: string;
  value: string;
  hint: string;
  hintClass: string;
  sparkColor: string;
  sparkData: number[];
}) {
  return (
    <Panel className="flex flex-col justify-between gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <MiniSparkline color={sparkColor} data={sparkData} />
      </div>
      <p className={`text-[11px] font-medium ${hintClass}`}>{hint}</p>
    </Panel>
  );
}

const QUICK_ACTIONS = [
  { label: 'Launch a new ad', href: '/chats', className: 'bg-primary/10 hover:bg-primary/15' },
  { label: 'Upload creatives', href: '/gallery', className: 'bg-violet-500/10 hover:bg-violet-500/15' },
  { label: 'Access reports', href: '/reports', className: 'bg-slate-500/10 hover:bg-slate-500/15' },
  { label: 'Go to ads manager', href: '/meta/posts', className: 'bg-amber-500/10 hover:bg-amber-500/15' },
] as const;

function RightRail({
  rows,
  dashboardLoading,
}: {
  rows: DashboardRow[];
  dashboardLoading: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <Panel className="shrink-0 p-3">
        <h3 className="mb-2.5 font-display text-sm font-semibold">Quick actions</h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-xl px-2 py-2.5 text-center text-[11px] font-semibold transition ${action.className}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </Panel>

      <AiInsightPanel rows={rows} dashboardLoading={dashboardLoading} />
    </div>
  );
}

export default function HomeOverviewClient({ displayName }: HomeOverviewClientProps) {
  const firstName = displayName?.trim()?.split(/\s+/)[0] ?? 'there';
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange(7));
  const {
    rows,
    metrics,
    busyAdIds,
    loading,
    bootstrapping,
    lastRefreshedAt,
    error,
    currency,
    setCurrency,
    refresh,
    toggleStatus,
    autoPause,
  } = useDashboardData();

  const showPlaceholder = bootstrapping && !rows.length;
  const isBackgroundSync = loading && rows.length > 0;

  const filteredRows = useMemo(
    () => filterRowsByDateRange(rows, metrics, dateRange),
    [rows, metrics, dateRange],
  );

  const filteredMetrics = useMemo(
    () => filterMetricsByDateRange(metrics, dateRange),
    [metrics, dateRange],
  );

  const kpis = useMemo(() => computeHomeKpis(filteredRows, currency), [filteredRows, currency]);
  const signalMix = useMemo(() => computeSignalMix(filteredRows), [filteredRows]);
  const spendSpark = useMemo(() => spendSeriesFromRows(filteredRows, currency), [filteredRows, currency]);

  const performanceChartData = useMemo(() => {
    return bucketMetricsByDay(filteredMetrics).map((b) => ({
      day: formatChartDayLabel(b.date),
      spend: convertFromInr(b.spendInr, currency),
      ctr: Number((b.avgCtr * 100).toFixed(2)),
    }));
  }, [filteredMetrics, currency]);

  const activeCurrency = CURRENCIES.find((c) => c.value === currency);

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-0 flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight lg:text-2xl">
            Welcome back, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Live snapshot of your Meta Ads performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div className="flex items-center rounded-xl border border-[var(--glass-border-subtle)] bg-background/40 p-0.5">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCurrency(c.value)}
                className={[
                  'rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition-all',
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
            onClick={() => void refresh()}
            disabled={loading || bootstrapping}
            className={[
              'glass-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold',
              loading || bootstrapping ? 'opacity-70' : '',
            ].join(' ')}
          >
            {loading ? (
              <>
                <AiOutlineLoading className="h-4 w-4 animate-spin" />
                {isBackgroundSync ? 'Syncing…' : 'Refreshing…'}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            )}
          </button>
          {lastRefreshedAt && !bootstrapping ? (
            <p className="w-full text-[11px] text-muted-foreground sm:w-auto">
              {isBackgroundSync ? 'Updating from Meta…' : `Data as of ${new Date(lastRefreshedAt).toLocaleString()}`}
            </p>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Spend Today"
          value={showPlaceholder ? '—' : kpis.spendToday}
          hint={filteredRows.length ? `${filteredRows.length} ads in range` : 'No ads in selected range'}
          hintClass="text-muted-foreground"
          sparkColor="oklch(0.65 0.18 25)"
          sparkData={spendSpark}
        />
        <StatCard
          label="Active Ads"
          value={showPlaceholder ? '—' : String(kpis.activeAds)}
          hint={`${filteredRows.length} in range`}
          hintClass="text-muted-foreground"
          sparkColor="#22c55e"
          sparkData={spendSpark}
        />
        <StatCard
          label="Winning Ads"
          value={showPlaceholder ? '—' : String(kpis.winningAds)}
          hint={kpis.winningRate !== '0.0%' ? `${kpis.winningRate} winning rate` : 'No winners yet'}
          hintClass="text-emerald-600"
          sparkColor="#eab308"
          sparkData={spendSpark}
        />
        <StatCard
          label="CTR (Avg)"
          value={showPlaceholder ? '—' : kpis.avgCtr}
          hint="Across loaded ads"
          hintClass="text-muted-foreground"
          sparkColor="#a855f7"
          sparkData={spendSpark}
        />
        <StatCard
          label="CPI (Avg)"
          value={showPlaceholder ? '—' : kpis.avgCpi}
          hint="Across ads with CPI"
          hintClass="text-muted-foreground"
          sparkColor="#3b82f6"
          sparkData={spendSpark}
        />
        <Panel className="flex flex-col justify-between p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Alerts</p>
              <p className="font-display mt-0.5 text-lg font-semibold">
                {showPlaceholder ? '—' : kpis.alertCount}
              </p>
            </div>
            <TriangleAlert className="h-5 w-5 text-destructive" />
          </div>
          <p className={`text-[11px] font-medium ${kpis.alertCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {kpis.alertCount > 0 ? 'Needs attention' : 'All clear'}
          </p>
        </Panel>
      </div>

      {/* Middle: table + right rail */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col overflow-hidden lg:col-span-9">
          <AdPerformanceTable
            rows={filteredRows}
            onToggleStatus={toggleStatus}
            onAutoPause={autoPause}
            busyAdIds={busyAdIds}
            currency={currency}
          />
        </div>
        <div className="min-h-0 max-h-[220px] lg:col-span-3 lg:max-h-full">
          <RightRail rows={filteredRows} dashboardLoading={bootstrapping || loading} />
        </div>
      </div>

      {/* Bottom charts */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-12" style={{ height: 'min(32vh, 240px)' }}>
        <Panel className="flex min-h-0 flex-col p-3 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold">Performance Overview</h3>
              <p className="text-[11px] text-muted-foreground">
                Spend ({activeCurrency?.sym}) vs CTR (%)
              </p>
            </div>
            <button type="button" className="glass-button inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold">
              Daily <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {performanceChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {bootstrapping ? 'Loading metrics…' : 'No chart data — hit Refresh'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceChartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border-subtle)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} height={22} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9 }} width={40} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} width={36} />
                  <Tooltip
                    formatter={(v, name) => {
                      const n = Number(v) || 0;
                      if (name === 'Spend') {
                        const sym = activeCurrency?.sym ?? '₹';
                        return [`${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                      }
                      return [`${n.toFixed(2)}%`, name];
                    }}
                    contentStyle={{ borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
                  <Line yAxisId="left" type="monotone" dataKey="spend" name="Spend" stroke="oklch(0.65 0.18 25)" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="ctr" name="CTR" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col p-3 lg:col-span-5">
          <h3 className="mb-2 font-display text-sm font-semibold">Signal Mix</h3>
          <div className="flex min-h-0 flex-1 gap-3">
            {signalMix.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                {bootstrapping ? 'Loading…' : 'No signal data'}
              </div>
            ) : (
              <>
                <div className="h-full w-[42%] min-w-[100px] max-w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={signalMix} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                        {signalMix.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 text-xs">
                  {signalMix.map((s) => {
                    const total = signalMix.reduce((a, b) => a + b.value, 0);
                    const pct = total ? ((s.value / total) * 100).toFixed(1) : '0';
                    return (
                      <li key={s.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                          <span className="text-muted-foreground">{s.name}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {s.value} ({pct}%)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 border-t border-[var(--glass-border-subtle)] pt-2">
            <div className="rounded-xl border border-[var(--glass-border-subtle)] bg-muted/20 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active Ads</p>
              <p className="font-display text-base font-semibold">{kpis.activeAds}</p>
              <p className="text-[10px] font-medium text-muted-foreground">{filteredRows.length} in range</p>
            </div>
            <div className="rounded-xl border border-[var(--glass-border-subtle)] bg-muted/20 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Winning Rate</p>
              <p className="font-display text-base font-semibold">{kpis.winningRate}</p>
              <p className="text-[10px] font-medium text-emerald-600">{kpis.winningAds} winners</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
