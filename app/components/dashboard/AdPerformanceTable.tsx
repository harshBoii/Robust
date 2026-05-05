'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import StatusSignalBadge from '@/app/components/dashboard/StatusSignalBadge';
import { convertToInr, fmtCurrency, type Currency } from '@/lib/currency';

function fmtPct(n: number | null | undefined) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

function toInr(display: string, currency: Currency): number | null {
  const n = parseFloat(display.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return convertToInr(n, currency);
}

export type DashboardRow = {
  adId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | string | null;
  thumbnailUrl: string | null;
  spendToday: number;
  spendTotal: number;
  cpi: number | null;
  ctr: number;
  hookRate: number | null;
  daysRunning?: number | null;
  statusSignal?: 'WINNER' | 'FATIGUE' | 'UNDERPERFORMER' | null;
};

type SortKey = 'name' | 'spendToday' | 'spendTotal' | 'cpi' | 'ctr' | 'hookRate' | 'daysRunning';
type SortDir = 'asc' | 'desc';
type RangeState = { min: string; max: string };

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const emptyRange = (): RangeState => ({ min: '', max: '' });

function SortableHeader({
  label, sortKey, currentKey, dir, onSort, className,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey;
  dir: SortDir; onSort: (k: SortKey) => void; className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={[
        'cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left',
        'font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground',
        'transition-colors hover:text-foreground',
        className ?? '',
      ].join(' ')}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={['transition-opacity', active ? 'opacity-100' : 'opacity-25'].join(' ')}>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

function RangeInputs({
  label, unit, range, onChange,
}: {
  label: string; unit: string; range: RangeState;
  onChange: (r: RangeState) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-ui text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label} <span className="normal-case opacity-60">({unit})</span>
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          placeholder="Min"
          className="glass-input w-24 px-2.5 py-1.5 text-xs"
          value={range.min}
          onChange={(e) => onChange({ ...range, min: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="number"
          placeholder="Max"
          className="glass-input w-24 px-2.5 py-1.5 text-xs"
          value={range.max}
          onChange={(e) => onChange({ ...range, max: e.target.value })}
        />
      </div>
    </div>
  );
}

const SYM: Record<Currency, string> = { USD: '$', GBP: '£', INR: '₹' };

export default function AdPerformanceTable({
  rows, onToggleStatus, onAutoPause, busyAdIds, currency,
}: {
  rows: DashboardRow[];
  onToggleStatus: (adId: string, nextStatus: 'ACTIVE' | 'PAUSED') => void;
  onAutoPause: () => void;
  busyAdIds: Set<string>;
  currency: Currency;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'WINNER' | 'FATIGUE' | 'UNDERPERFORMER'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('spendToday');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showRanges, setShowRanges] = useState(false);

  const [spendTodayRange, setSpendTodayRange] = useState<RangeState>(emptyRange);
  const [spendTotalRange, setSpendTotalRange] = useState<RangeState>(emptyRange);
  const [cpiRange, setCpiRange] = useState<RangeState>(emptyRange);
  const [ctrRange, setCtrRange] = useState<RangeState>(emptyRange);

  const rangeActive = [spendTodayRange, spendTotalRange, cpiRange, ctrRange].some(
    (r) => r.min !== '' || r.max !== '',
  );

  function clearRanges() {
    setSpendTodayRange(emptyRange()); setSpendTotalRange(emptyRange());
    setCpiRange(emptyRange()); setCtrRange(emptyRange()); setPage(0);
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  }

  const filtered = useMemo(() => {
    const st_min = toInr(spendTodayRange.min, currency);
    const st_max = toInr(spendTodayRange.max, currency);
    const sl_min = toInr(spendTotalRange.min, currency);
    const sl_max = toInr(spendTotalRange.max, currency);
    const cp_min = toInr(cpiRange.min, currency);
    const cp_max = toInr(cpiRange.max, currency);
    const ct_min = ctrRange.min !== '' ? parseFloat(ctrRange.min) / 100 : null;
    const ct_max = ctrRange.max !== '' ? parseFloat(ctrRange.max) / 100 : null;

    return rows.filter((r) => {
      const q = search.trim().toLowerCase();
      if (q && !r.name.toLowerCase().includes(q) && !r.adId.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && (r.status ?? '').toUpperCase() !== statusFilter) return false;
      if (signalFilter !== 'ALL' && (r.statusSignal ?? '') !== signalFilter) return false;
      if (st_min !== null && r.spendToday < st_min) return false;
      if (st_max !== null && r.spendToday > st_max) return false;
      if (sl_min !== null && r.spendTotal < sl_min) return false;
      if (sl_max !== null && r.spendTotal > sl_max) return false;
      const cpiVal = r.cpi ?? null;
      if (cp_min !== null && (cpiVal === null || cpiVal < cp_min)) return false;
      if (cp_max !== null && (cpiVal === null || cpiVal > cp_max)) return false;
      if (ct_min !== null && r.ctr < ct_min) return false;
      if (ct_max !== null && r.ctr > ct_max) return false;
      return true;
    });
  }, [rows, search, statusFilter, signalFilter, spendTodayRange, spendTotalRange, cpiRange, ctrRange, currency]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'name': return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'spendToday':  av = a.spendToday ?? 0;   bv = b.spendToday ?? 0;  break;
        case 'spendTotal':  av = a.spendTotal ?? 0;   bv = b.spendTotal ?? 0;  break;
        case 'cpi':         av = a.cpi ?? -1;          bv = b.cpi ?? -1;        break;
        case 'ctr':         av = a.ctr ?? 0;           bv = b.ctr ?? 0;         break;
        case 'hookRate':    av = a.hookRate ?? -1;     bv = b.hookRate ?? -1;   break;
        case 'daysRunning': av = a.daysRunning ?? -1;  bv = b.daysRunning ?? -1;break;
        default: return 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const sym = SYM[currency];

  return (
    <div className="glass-card overflow-hidden">

      {/* ── Card Header ── */}
      <div className="border-b border-border/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight">
              Ad Performance
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Meta Ads snapshot — modeled CPI &amp; creative signals.
            </p>
          </div>
          <button
            className="glass-button flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
            onClick={onAutoPause}
            type="button"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            Auto-pause
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="glass-input w-48 shrink-0 pl-8 pr-3 py-2 text-sm"
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          <select
            className="glass-input px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
          </select>

          <select
            className="glass-input px-3 py-2 text-sm"
            value={signalFilter}
            onChange={(e) => { setSignalFilter(e.target.value as typeof signalFilter); setPage(0); }}
          >
            <option value="ALL">All signals</option>
            <option value="WINNER">Winner</option>
            <option value="FATIGUE">Fatigue</option>
            <option value="UNDERPERFORMER">Underperformer</option>
          </select>

          <button
            type="button"
            onClick={() => setShowRanges((v) => !v)}
            className={[
              'glass-button flex items-center gap-1.5 px-3 py-2 text-sm',
              rangeActive ? 'ring-1 ring-primary/60' : '',
            ].join(' ')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Ranges
            {rangeActive && (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>

          {rangeActive && (
            <button
              type="button"
              onClick={clearRanges}
              className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="font-ui text-xs text-muted-foreground">
              {filtered.length} ad{filtered.length !== 1 ? 's' : ''}
            </span>
            <select
              className="glass-input px-3 py-2 text-sm"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Range filter panel ── */}
        {showRanges && (
          <div className="mt-3 rounded-2xl border border-border/50 bg-background/20 px-5 py-4">
            <div className="flex flex-wrap gap-6">
              <RangeInputs label="Spend today" unit={sym} range={spendTodayRange} onChange={(r) => { setSpendTodayRange(r); setPage(0); }} />
              <RangeInputs label="Spend total" unit={sym} range={spendTotalRange} onChange={(r) => { setSpendTotalRange(r); setPage(0); }} />
              <RangeInputs label="CPI"         unit={sym} range={cpiRange}        onChange={(r) => { setCpiRange(r);        setPage(0); }} />
              <RangeInputs label="CTR"         unit="%"   range={ctrRange}        onChange={(r) => { setCtrRange(r);        setPage(0); }} />
            </div>
            <p className="mt-3 font-ui text-[11px] text-muted-foreground">
              Enter values in <strong>{currency}</strong> — converted from INR automatically.
            </p>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[1000px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border/40 bg-background/60 backdrop-blur-sm">
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Creative
              </th>
              <SortableHeader label="Ad name"     sortKey="name"        currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Spend today" sortKey="spendToday"  currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Spend total" sortKey="spendTotal"  currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="CPI"         sortKey="cpi"         currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="CTR"         sortKey="ctr"         currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Hook rate"   sortKey="hookRate"    currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHeader label="Days"        sortKey="daysRunning" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Signal
              </th>
              <th className="px-3 py-3 text-right font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const isBusy = busyAdIds.has(r.adId);
              const isActive = (r.status ?? '').toUpperCase() === 'ACTIVE';
              const nextStatus: 'ACTIVE' | 'PAUSED' = isActive ? 'PAUSED' : 'ACTIVE';

              return (
                <tr
                  key={r.adId}
                  className={[
                    'group border-b border-border/30 transition-colors duration-150',
                    'hover:bg-[var(--glass-hover)]',
                    i % 2 === 0 ? '' : 'bg-background/10',
                  ].join(' ')}
                >
                  {/* Thumbnail */}
                  <td className="px-3 py-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-border/50 bg-muted shadow-sm">
                      {r.thumbnailUrl ? (
                        <Image src={r.thumbnailUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground/40">
                          —
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Name + ID */}
                  <td className="px-3 py-3">
                    <div className="max-w-[260px] truncate text-sm font-medium text-foreground">
                      {r.name || '—'}
                    </div>
                    <div className="font-data mt-0.5 truncate text-[11px] text-muted-foreground/70">
                      {r.adId}
                    </div>
                  </td>

                  {/* Numeric cells */}
                  <td className="px-3 py-3 font-data text-sm tabular-nums">{fmtCurrency(r.spendToday ?? 0, currency)}</td>
                  <td className="px-3 py-3 font-data text-sm tabular-nums">{fmtCurrency(r.spendTotal ?? 0, currency)}</td>
                  <td className="px-3 py-3 font-data text-sm tabular-nums">
                    {typeof r.cpi === 'number' && r.cpi > 0 ? fmtCurrency(r.cpi, currency) : '—'}
                  </td>
                  <td className="px-3 py-3 font-data text-sm tabular-nums">{fmtPct(r.ctr)}</td>
                  <td className="px-3 py-3 font-data text-sm tabular-nums">{fmtPct(r.hookRate)}</td>
                  <td className="px-3 py-3 font-data text-sm tabular-nums">
                    {typeof r.daysRunning === 'number' ? r.daysRunning : '—'}
                  </td>

                  {/* Signal badge */}
                  <td className="px-3 py-3">
                    <StatusSignalBadge signal={r.statusSignal ?? null} />
                  </td>

                  {/* Action */}
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onToggleStatus(r.adId, nextStatus)}
                      className={[
                        'min-w-[80px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        isActive
                          ? 'glass-button'
                          : 'glass-button-primary',
                      ].join(' ')}
                    >
                      {isBusy ? (
                        <span className="flex items-center justify-center gap-1">
                          <AiOutlineLoading className="h-3 w-3 animate-spin" aria-hidden />
                          …
                        </span>
                      ) : isActive ? 'Pause' : 'Turn on'}
                    </button>
                  </td>
                </tr>
              );
            })}

            {!pageRows.length && (
              <tr>
                <td colSpan={10} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    <span className="text-sm">
                      {rows.length ? 'No ads match your filters.' : 'No ads found. Connect Meta and hit Refresh.'}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
          <span className="font-ui text-xs text-muted-foreground">
            Page {safePage + 1} of {totalPages} — {filtered.length} results
          </span>
          <div className="flex gap-1">
            {[
              { label: '«', action: () => setPage(0),                       disabled: safePage === 0 },
              { label: '‹', action: () => setPage((p) => Math.max(0, p - 1)), disabled: safePage === 0 },
              { label: '›', action: () => setPage((p) => Math.min(totalPages - 1, p + 1)), disabled: safePage >= totalPages - 1 },
              { label: '»', action: () => setPage(totalPages - 1),          disabled: safePage >= totalPages - 1 },
            ].map(({ label, action, disabled }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                disabled={disabled}
                className="glass-button h-8 w-8 rounded-xl text-sm disabled:opacity-30"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}