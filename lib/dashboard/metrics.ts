import type { DashboardMetric } from '@/lib/dashboard/client';

export type DayBucket = {
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

export function bucketMetricsByDay(metrics: DashboardMetric[]): DayBucket[] {
  const todayRows = metrics.filter((m) => m.datePreset === 'today');
  const latestByAdDay = new Map<string, DashboardMetric>();
  for (const m of todayRows) {
    const day = dayKeyFromIso(m.recordedAt);
    const key = `${m.metaAdId}::${day}`;
    const prev = latestByAdDay.get(key);
    if (!prev || new Date(m.recordedAt).getTime() > new Date(prev.recordedAt).getTime()) {
      latestByAdDay.set(key, m);
    }
  }
  const buckets = new Map<string, { rows: DashboardMetric[] }>();
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
    let winners = 0;
    let fatigue = 0;
    let underperformers = 0;
    let none = 0;
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

export function formatChartDayLabel(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
