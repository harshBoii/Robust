import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import type { DashboardMetric } from '@/lib/dashboard/client';

export type DateRangeValue = {
  start: Date;
  end: Date;
};

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function defaultDateRange(days = 7): DateRangeValue {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}

export function formatDateRangeLabel(range: DateRangeValue): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = range.start.toLocaleDateString('en-US', opts);
  const end = range.end.toLocaleDateString('en-US', opts);
  return start === end ? start : `${start} – ${end}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= startOfDay(start).getTime() && t <= endOfDay(end).getTime();
}

export function inferAdPublishDate(row: DashboardRow, reference = new Date()): Date | null {
  if (row.publishedAt) {
    const d = new Date(row.publishedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof row.daysRunning === 'number' && Number.isFinite(row.daysRunning)) {
    const d = startOfDay(reference);
    d.setDate(d.getDate() - row.daysRunning);
    return d;
  }
  return null;
}

/** Ads published in range, or with metric snapshots recorded in range. */
export function filterRowsByDateRange(
  rows: DashboardRow[],
  metrics: DashboardMetric[],
  range: DateRangeValue,
): DashboardRow[] {
  const startMs = startOfDay(range.start).getTime();
  const endMs = endOfDay(range.end).getTime();

  const adIdsWithMetrics = new Set(
    metrics
      .filter((m) => {
        const t = new Date(m.recordedAt).getTime();
        return t >= startMs && t <= endMs;
      })
      .map((m) => m.metaAdId),
  );

  return rows.filter((row) => {
    if (adIdsWithMetrics.has(row.adId)) return true;
    const pub = inferAdPublishDate(row);
    if (!pub) return false;
    const t = pub.getTime();
    return t >= startMs && t <= endMs;
  });
}

export function filterMetricsByDateRange(
  metrics: DashboardMetric[],
  range: DateRangeValue,
): DashboardMetric[] {
  const startMs = startOfDay(range.start).getTime();
  const endMs = endOfDay(range.end).getTime();
  return metrics.filter((m) => {
    const t = new Date(m.recordedAt).getTime();
    return t >= startMs && t <= endMs;
  });
}

export function calendarDaysForMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
