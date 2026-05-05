'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

import { fmtCurrency, type Currency } from '@/lib/currency';

type MetricRow = {
  metaAdId: string;
  spend: number;
  ctr: number;
  statusSignal: string | null;
  datePreset: string;
  recordedAt: string;
};

type DayBucket = {
  date: string;
  spendInr: number;
  avgCtr: number;
  activeAds: number;
  winners: number;
  fatigue: number;
  underperformers: number;
  none: number;
};

function dayKeyFromIso(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function bucketByDay(metrics: MetricRow[]): DayBucket[] {
  const todayRows = metrics.filter((m) => m.datePreset === 'today');
  const latestByAdDay = new Map<string, MetricRow>();
  for (const m of todayRows) {
    const day = dayKeyFromIso(m.recordedAt);
    const key = `${m.metaAdId}::${day}`;
    const prev = latestByAdDay.get(key);
    if (!prev || new Date(m.recordedAt).getTime() > new Date(prev.recordedAt).getTime()) {
      latestByAdDay.set(key, m);
    }
  }
  const buckets = new Map<string, { rows: MetricRow[] }>();
  for (const m of latestByAdDay.values()) {
    const day = dayKeyFromIso(m.recordedAt);
    const b = buckets.get(day) ?? { rows: [] };
    b.rows.push(m);
    buckets.set(day, b);
  }
  const result: DayBucket[] = [];
  for (const [day, b] of buckets.entries()) {
    const spendInr = b.rows.reduce((acc, r) => acc + (r.spend ?? 0), 0);
    const ctrs = b.rows.map((r) => r.ctr ?? 0).filter((n) => Number.isFinite(n) && n > 0);
    const avgCtr = ctrs.length ? ctrs.reduce((a, c) => a + c, 0) / ctrs.length : 0;
    const activeAds = new Set(b.rows.map((r) => r.metaAdId)).size;
    let winners = 0, fatigue = 0, underperformers = 0, none = 0;
    for (const r of b.rows) {
      if (r.statusSignal === 'WINNER') winners++;
      else if (r.statusSignal === 'FATIGUE') fatigue++;
      else if (r.statusSignal === 'UNDERPERFORMER') underperformers++;
      else none++;
    }
    result.push({ date: day, spendInr, avgCtr, activeAds, winners, fatigue, underperformers, none });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Shared tooltip style ── */
const tooltipStyle = {
  contentStyle: {
    background: 'var(--glass-bg-solid)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    backdropFilter: 'blur(20px)',
    fontSize: '12px',
    boxShadow: 'var(--glass-shadow)',
    color: 'var(--foreground)',
  },
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  cursor: { stroke: 'var(--glass-border)', strokeWidth: 1 },
};

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground)' };
const gridStyle = { stroke: 'var(--glass-border)', strokeDasharray: '3 3', opacity: 0.6 };

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="glass-card flex flex-col gap-3 p-5">
      <div>
        <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">{subtitle}</p>
        )}
      </div>
      <div className="h-44 w-full">{children}</div>
    </div>
  );
}

/* ── Signal colors keyed to brand palette ── */
const SIGNAL_COLORS = {
  winners: 'oklch(0.72 0.19 150)', // green
  fatigue: 'var(--muted-foreground)', // slow performer (grey)
  underperformers: 'oklch(0.66 0.22 30)', // red
  none: 'oklch(0.86 0.17 95)', // yellow
};

export default function DashboardCharts({
  metrics,
  currency,
}: {
  metrics: MetricRow[];
  currency: Currency;
}) {
  const data = bucketByDay(metrics);

  if (!data.length) {
    return (
      <div className="glass-card flex items-center justify-center py-12 text-sm text-muted-foreground">
        No chart data yet — hit <span className="mx-1 font-semibold text-foreground">Refresh</span> to load metrics.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

      {/* Spend per day */}
      <ChartCard title="Spend / day" subtitle="Daily total in selected currency">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--clipfox-primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--clipfox-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtCurrency(Number(v) || 0, currency)}
              width={64}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v) => [fmtCurrency(Number(v) || 0, currency), 'Spend']}
            />
            <Line
              type="monotone"
              dataKey="spendInr"
              stroke="var(--clipfox-primary)"
              strokeWidth={2}
              dot={{ fill: 'var(--clipfox-primary)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Avg CTR per day */}
      <ChartCard title="Avg CTR / day" subtitle="Mean click-through rate across active ads">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
              width={44}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v) => [`${(Number(v) * 100).toFixed(2)}%`, 'CTR']}
            />
            <Line
              type="monotone"
              dataKey="avgCtr"
              stroke="var(--clipfox-accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--clipfox-accent)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Active ads per day */}
      <ChartCard title="Active ads / day" subtitle="Unique ad count recorded per day">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Active ads']} />
            <Line
              type="monotone"
              dataKey="activeAds"
              stroke="var(--clipfox-primary-light)"
              strokeWidth={2}
              dot={{ fill: 'var(--clipfox-primary-light)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Signal mix per day */}
      <ChartCard title="Signal mix / day" subtitle="Winner · Slow · Underperformer · None">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              {Object.entries(SIGNAL_COLORS).map(([key, color]) => (
                <linearGradient key={key} id={`sig-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip {...tooltipStyle} />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
              iconType="circle"
              iconSize={7}
            />
            <Area type="monotone" dataKey="winners"         stackId="1" stroke={SIGNAL_COLORS.winners}         fill={`url(#sig-winners)`}         name="Winner" />
            <Area type="monotone" dataKey="fatigue"         stackId="1" stroke={SIGNAL_COLORS.fatigue}         fill={`url(#sig-fatigue)`}         name="Slow" />
            <Area type="monotone" dataKey="underperformers" stackId="1" stroke={SIGNAL_COLORS.underperformers} fill={`url(#sig-underperformers)`} name="Underperformer" />
            <Area type="monotone" dataKey="none"            stackId="1" stroke={SIGNAL_COLORS.none}            fill={`url(#sig-none)`}            name="None" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
}