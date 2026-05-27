'use client';

import { useEffect, useMemo, useState } from 'react';
import { ViewMoreDropdown } from '@/app/components/common/UI/ViewMoreDropdown';
import {
  cleanCompanyNameForLabel,
} from '@/lib/geo/geoknight/companyNameMatch';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type SovPoint = {
  calculatedAt: string;
  shareOfVoice: number | null;
  model?: string;
};

export const RIVAL_COLORS = [
  '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#84cc16',
  '#f59e0b', '#14b8a6', '#6366f1', '#ef4444', '#10b981',
];

function collapseByDay(points: SovPoint[]): Map<number, number> {
  const sorted = [...points].sort(
    (a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime(),
  );
  const byDay = new Map<number, number>();
  for (const d of sorted) {
    if (d.shareOfVoice == null || Number.isNaN(d.shareOfVoice)) continue;
    const ts = new Date(d.calculatedAt);
    if (!Number.isFinite(ts.getTime())) continue;
    const dayKey = Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate());
    byDay.set(dayKey, d.shareOfVoice);
  }
  return byDay;
}

export function SovTrendChart({
  series,
  compare,
  rivalColor,
  primaryName = 'You',
}: {
  series: SovPoint[];
  compare?: { label: string; series: SovPoint[] } | null;
  rivalColor?: string;
  primaryName?: string;
}) {
  const ourByDay = collapseByDay(series ?? []);
  const compareByDay = compare ? collapseByDay(compare.series ?? []) : new Map<number, number>();
  const daySet = new Set<number>([...ourByDay.keys(), ...compareByDay.keys()]);
  const dayList = [...daySet].sort((a, b) => a - b);
  const data = dayList.map((dayKey) => ({
    dayKey,
    label: new Date(dayKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    fullLabel: new Date(dayKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    sov: ourByDay.get(dayKey) ?? null,
    rivalSov: compareByDay.get(dayKey) ?? null,
  }));

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground py-8 text-center">No trend data yet.</p>;
  }

  const showOurDots = ourByDay.size <= 2;
  const showRivalDots = compareByDay.size <= 2;

  return (
    <div className="h-[220px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--glass-border)]" />
          <XAxis dataKey="dayKey" tick={{ fontSize: 10 }} tickFormatter={(_, i) => data[i]?.label ?? ''} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''}
            formatter={(value, name) => {
              const n = typeof value === 'number' ? value : Number(value ?? 0);
              const label =
                name === 'rivalSov'
                  ? compare
                    ? `${compare.label} SoV`
                    : 'Rival SoV'
                  : `${primaryName} SoV`;
              return [`${n.toFixed(1)}`, label];
            }}
            contentStyle={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="sov" name={primaryName} stroke="var(--primary)" dot={showOurDots} strokeWidth={2} connectNulls />
          {compare ? (
            <Line type="monotone" dataKey="rivalSov" name={compare.label} stroke={rivalColor ?? RIVAL_COLORS[0]} dot={showRivalDots} strokeWidth={2} connectNulls />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export type ModelBreakRow = {
  model: string;
  avgShareOfVoice: number;
  avgTop3Rate: number;
  avgQueryCoverage: number;
};

export type PromptByModel = { model: string; count: number };

const PIE_COLORS = [
  'var(--primary)', '#f97316', '#a855f7', '#06b6d4', '#ec4899',
  '#84cc16', '#f59e0b', '#14b8a6', '#6366f1', '#ef4444', '#10b981',
];

export function ModelPromptPieChart({ data = [] }: { data?: PromptByModel[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground py-8 text-center">No prompt data by model.</p>;
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="h-[260px] w-full min-w-0 flex items-center">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="model"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={85}
            paddingAngle={2}
            label={(entry) => {
              const payload = entry as unknown as { model?: string; count?: number };
              const m = String(payload.model ?? '');
              const c = Number(payload.count ?? 0);
              const pct = total > 0 ? ((c / total) * 100).toFixed(1) : '0';
              const name = m.length > 14 ? `${m.slice(0, 14)}…` : m;
              return `${name} (${pct}%)`;
            }}
            labelLine={{ strokeWidth: 1 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--glass-border)" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const v = Number(value ?? 0);
              return [
                `${v} prompt${v !== 1 ? 's' : ''} (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`,
                String(name ?? ''),
              ];
            }}
            contentStyle={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RadarCompareCharts({
  base,
  rivals,
}: {
  base: { sovSeries: SovPoint[]; promptsByModel?: PromptByModel[]; modelBreakdown?: ModelBreakRow[] };
  rivals: Array<{ id: string; name: string }>;
}) {
  const [compareId, setCompareId] = useState('');
  const [comparePayload, setComparePayload] = useState<{
    sovSeries?: SovPoint[];
    promptsByModel?: PromptByModel[];
    latest?: { shareOfVoice?: number | null; top3Rate?: number | null; queryCoverage?: number | null; competitorRank?: number | null; calculatedAt?: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [basePromptsByModel, setBasePromptsByModel] = useState<PromptByModel[]>(base.promptsByModel ?? []);
  const [basePromptsLoading, setBasePromptsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if ((base.promptsByModel ?? []).length > 0) {
        setBasePromptsByModel(base.promptsByModel ?? []);
        return;
      }
      setBasePromptsLoading(true);
      try {
        const res = await fetch('/api/geo/radar/prompts-by-model', { method: 'GET', credentials: 'include' });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          setBasePromptsByModel([]);
          return;
        }
        setBasePromptsByModel((json.promptsByModel ?? []) as PromptByModel[]);
      } finally {
        if (!cancelled) setBasePromptsLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [base.promptsByModel]);

  const basePromptTotal = useMemo(
    () => (basePromptsByModel ?? []).reduce((s, r) => s + (Number(r.count) || 0), 0),
    [basePromptsByModel],
  );

  const compareLabel = useMemo(() => {
    const raw = rivals.find((r) => r.id === compareId)?.name ?? '';
    return cleanCompanyNameForLabel(raw) || raw || 'Rival';
  }, [compareId, rivals]);

  const rivalColor = useMemo(() => {
    const idx = rivals.findIndex((r) => r.id === compareId);
    return idx >= 0 ? (RIVAL_COLORS[idx % RIVAL_COLORS.length] ?? RIVAL_COLORS[0]) : RIVAL_COLORS[0];
  }, [compareId, rivals]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!compareId) {
        setComparePayload(null);
        setErr(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/geo/radar/compare?companyId=${encodeURIComponent(compareId)}`, { method: 'GET', credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setErr(data?.error ?? 'Failed to load rival radar payload.');
          setComparePayload(null);
          return;
        }
        setComparePayload(data.payload ?? null);
      } catch {
        if (cancelled) return;
        setErr('Network error while loading rival payload.');
        setComparePayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [compareId]);

  const compare = comparePayload
    ? { label: compareLabel, sovSeries: (comparePayload.sovSeries ?? []) as SovPoint[], promptsByModel: (comparePayload.promptsByModel ?? []) as PromptByModel[] }
    : null;

  const rivalLatest = comparePayload?.latest ?? null;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Compare is based on the rival&apos;s persisted radar runs.</p>
          {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Compare vs</label>
          <ViewMoreDropdown tooltipContent="Pick rival" align="right">
            {(close) => (
              <div className="py-1">
                <button type="button" onClick={() => { setCompareId(''); close(); }} className={`w-full px-3 py-2 text-left text-xs ${compareId === '' ? 'text-primary font-medium bg-primary/10' : 'text-foreground hover:bg-[var(--glass-hover)]'}`}>None</button>
                {rivals.map((r, idx) => {
                  const color = RIVAL_COLORS[idx % RIVAL_COLORS.length] ?? RIVAL_COLORS[0]!;
                  return (
                    <button key={r.id} type="button" onClick={() => { setCompareId(r.id); close(); }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs ${compareId === r.id ? 'text-primary font-medium bg-primary/10' : 'text-foreground hover:bg-[var(--glass-hover)]'}`}>
                      <span className="inline-block shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
                      {cleanCompanyNameForLabel(r.name) || r.name}
                    </button>
                  );
                })}
              </div>
            )}
          </ViewMoreDropdown>
          <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2.5 py-2 text-xs">
            {compareId ? cleanCompanyNameForLabel(rivals.find((r) => r.id === compareId)?.name ?? '') || rivals.find((r) => r.id === compareId)?.name || 'Selected rival' : 'None'}
          </div>
          {loading ? <span className="text-[11px] text-muted-foreground">Loading…</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-card card-anime-float min-w-0 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground">Share of voice trend</h3>
          <p className="text-xs text-muted-foreground mt-1">Recent radar runs</p>
          <div className="mt-2 min-h-[220px] w-full min-w-0">
            <SovTrendChart series={base.sovSeries} compare={compare ? { label: compare.label, series: compare.sovSeries } : null} rivalColor={rivalColor} />
          </div>
        </div>
        <div className="glass-card card-anime-float min-w-0 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground">Prompts by model</h3>
          <p className="text-xs text-muted-foreground mt-1">Prompt distribution across LLMs{basePromptTotal ? ` · ${basePromptTotal} prompts tracked` : ''}</p>
          <div className="mt-2 min-h-[260px] w-full min-w-0">
            <ModelPromptPieChart data={basePromptsByModel ?? []} />
          </div>
          {basePromptsLoading ? <p className="mt-1 text-[11px] text-muted-foreground">Loading prompt metrics…</p> : null}
        </div>
      </div>

      {compareId && compare && rivalLatest ? (
        <div className="glass-card card-anime-float rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground">{compare.label} · recent snapshot</h3>
          <p className="text-xs text-muted-foreground mt-1">{rivalLatest?.calculatedAt ? new Date(rivalLatest.calculatedAt).toLocaleString() : '—'}</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'AI Share of Voice', value: rivalLatest.shareOfVoice, suffix: '%', digits: 1 },
              { label: 'Top-3 Mention Rate', value: rivalLatest.top3Rate, suffix: '%', digits: 0 },
              { label: 'Query Coverage', value: rivalLatest.queryCoverage, suffix: '%', digits: 1 },
              { label: 'Competitor rank', value: rivalLatest.competitorRank, prefix: '#', digits: 1 },
            ].map((c) => (
              <div key={c.label} className="rounded-lg bg-[var(--glass)]/60 border border-[var(--glass-border)]/60 p-3">
                <p className="text-[11px] font-semibold text-foreground">{c.label}</p>
                <p className="mt-2 text-xl font-semibold text-foreground tabular-nums tracking-tight">
                  {c.value == null || Number.isNaN(Number(c.value)) ? '—' : `${c.prefix ?? ''}${Number(c.value).toFixed(c.digits)}${c.suffix ?? ''}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
