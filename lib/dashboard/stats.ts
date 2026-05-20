import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import { convertFromInr, fmtCurrency, type Currency } from '@/lib/currency';

export type SignalMixSlice = {
  name: string;
  value: number;
  color: string;
};

const SIGNAL_COLORS = {
  winner: '#22c55e',
  weak: '#f59e0b',
  bad: '#ef4444',
  none: '#eab308',
};

export function computeSignalMix(rows: DashboardRow[]): SignalMixSlice[] {
  let winner = 0;
  let weak = 0;
  let bad = 0;
  let none = 0;
  for (const r of rows) {
    if (r.statusSignal === 'WINNER') winner++;
    else if (r.statusSignal === 'FATIGUE') weak++;
    else if (r.statusSignal === 'UNDERPERFORMER') bad++;
    else none++;
  }
  return [
    { name: 'Winner', value: winner, color: SIGNAL_COLORS.winner },
    { name: 'Weak', value: weak, color: SIGNAL_COLORS.weak },
    { name: 'Bad', value: bad, color: SIGNAL_COLORS.bad },
    { name: 'None', value: none, color: SIGNAL_COLORS.none },
  ].filter((s) => s.value > 0);
}

export type HomeKpis = {
  spendToday: string;
  activeAds: number;
  winningAds: number;
  avgCtr: string;
  avgCpi: string;
  alertCount: number;
  winningRate: string;
};

export function computeHomeKpis(rows: DashboardRow[], currency: Currency): HomeKpis {
  const spendTodayInr = rows.reduce((acc, r) => acc + (r.spendToday ?? 0), 0);
  const activeAds = rows.filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE').length;
  const winningAds = rows.filter((r) => r.statusSignal === 'WINNER').length;
  const ctrs = rows.map((r) => r.ctr).filter((n) => Number.isFinite(n) && n > 0);
  const avgCtr = ctrs.length ? ctrs.reduce((a, c) => a + c, 0) / ctrs.length : 0;
  const cpis = rows.map((r) => r.cpi).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const avgCpi = cpis.length ? cpis.reduce((a, c) => a + c, 0) / cpis.length : 0;
  const alertCount = rows.filter(
    (r) => r.statusSignal === 'UNDERPERFORMER' || r.statusSignal === 'FATIGUE',
  ).length;
  const winningRate = rows.length ? (winningAds / rows.length) * 100 : 0;

  return {
    spendToday: fmtCurrency(spendTodayInr, currency),
    activeAds,
    winningAds,
    avgCtr: `${(avgCtr * 100).toFixed(2)}%`,
    avgCpi: avgCpi > 0 ? fmtCurrency(avgCpi, currency) : '—',
    alertCount,
    winningRate: `${winningRate.toFixed(1)}%`,
  };
}

export function spendSeriesFromRows(rows: DashboardRow[], currency: Currency): number[] {
  if (!rows.length) return [0];
  const top = [...rows].sort((a, b) => b.spendToday - a.spendToday).slice(0, 7);
  return top.map((r) => convertFromInr(r.spendToday, currency));
}
