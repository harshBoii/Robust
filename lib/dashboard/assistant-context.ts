import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';

export type AssistantAdContext = {
  name: string;
  status: string | null;
  spendToday: number;
  spendTotal: number;
  cpi: number | null;
  ctr: number;
  hookRate: number | null;
  signal: string | null;
};

export type AssistantDashboardContext = {
  ads: AssistantAdContext[];
  totalSpendToday: number;
  totalAds: number;
  activeAds: number;
};

export function buildAssistantContext(rows: DashboardRow[]): AssistantDashboardContext {
  const sorted = [...rows].sort((a, b) => b.spendToday - a.spendToday);
  const totalSpendToday = rows.reduce((s, r) => s + (r.spendToday ?? 0), 0);
  const activeAds = rows.filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE').length;

  return {
    ads: sorted.slice(0, 12).map((r) => ({
      name: r.name,
      status: r.status,
      spendToday: r.spendToday,
      spendTotal: r.spendTotal,
      cpi: r.cpi,
      ctr: r.ctr,
      hookRate: r.hookRate,
      signal: r.statusSignal ?? null,
    })),
    totalSpendToday,
    totalAds: rows.length,
    activeAds,
  };
}
