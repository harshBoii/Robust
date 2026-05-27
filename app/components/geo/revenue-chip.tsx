'use client';

import { Tooltip } from '@/app/components/common/Tooltip';

export type RevenueBreakdown = {
  monthlyPromptReach?: number | null;
  visibilityWeight?: number | null;
  ctr?: number | null;
  cvr?: number | null;
  aov?: number | null;
};

export function formatRevenueCompact(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(value / 1_000).toFixed(1)}k`;
  if (Number.isInteger(value)) return `$${value.toLocaleString('en-US')}`;
  return `$${value.toFixed(1)}`;
}

function formatUsdPrecise(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPctRatio(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function breakdownLines(b: RevenueBreakdown | undefined): string[] {
  if (!b) return [];
  const lines: string[] = [];
  if (b.monthlyPromptReach != null && Number.isFinite(b.monthlyPromptReach)) {
    lines.push(`Monthly prompt reach: ${Math.round(b.monthlyPromptReach).toLocaleString('en-US')}`);
  }
  if (b.visibilityWeight != null && Number.isFinite(b.visibilityWeight)) {
    lines.push(`Visibility weight: ${formatPctRatio(b.visibilityWeight)}`);
  }
  if (b.ctr != null && Number.isFinite(b.ctr)) lines.push(`CTR: ${formatPctRatio(b.ctr)}`);
  if (b.cvr != null && Number.isFinite(b.cvr)) lines.push(`CVR: ${formatPctRatio(b.cvr)}`);
  if (b.aov != null && Number.isFinite(b.aov)) {
    lines.push(`AOV: ${formatUsdPrecise(b.aov)}`);
  }
  return lines;
}

export type RevenueChipProps = {
  amount: number;
  tooltipTitle?: string;
  tooltipLines?: string[];
  breakdown?: RevenueBreakdown;
  size?: 'sm' | 'md';
  className?: string;
};

export function RevenueChip({
  amount,
  tooltipTitle = 'Estimated revenue',
  tooltipLines,
  breakdown,
  size = 'md',
  className = '',
}: RevenueChipProps) {
  const display = formatRevenueCompact(amount);
  const precise = formatUsdPrecise(amount);
  const extra = [...(tooltipLines ?? []), ...breakdownLines(breakdown)];
  const uniqueLines = [...new Set(extra)];

  const tooltipBody = (
    <div className="space-y-1.5 text-left">
      {tooltipTitle ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sibling-accent)]">
          {tooltipTitle}
        </p>
      ) : null}
      <p className="text-sm font-semibold tabular-nums text-foreground">{precise}</p>
      {uniqueLines.length > 0 ? (
        <ul className="mt-1 space-y-0.5 border-t border-[var(--glass-border)]/60 pt-1.5 text-[11px] text-muted-foreground">
          {uniqueLines.map((line, i) => (
            <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const isSm = size === 'sm';
  const shell = isSm ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-2.5 py-1 text-xs';
  const dollarBadge = isSm ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]';

  return (
    <Tooltip content={tooltipBody} side="top">
      <span
        className={`inline-flex cursor-default items-center rounded-full border border-emerald-800/20 bg-gradient-to-r from-emerald-50/90 via-[var(--glass)]/90 to-emerald-100/70 font-semibold tabular-nums text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_8px_rgba(0,0,0,0.06)] ring-1 ring-emerald-900/10 backdrop-blur-sm dark:from-emerald-950/35 dark:via-[var(--glass)]/80 dark:to-emerald-950/25 dark:text-emerald-50 dark:border-emerald-400/20 dark:ring-emerald-400/15 ${shell} ${className}`}
        tabIndex={0}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-emerald-700/12 font-bold text-emerald-900 ring-1 ring-emerald-800/25 dark:bg-emerald-400/15 dark:text-emerald-50 dark:ring-emerald-300/25 ${dollarBadge}`}
          aria-hidden
        >
          $
        </span>
        <span className="text-emerald-950 dark:text-emerald-50">{display}</span>
      </span>
    </Tooltip>
  );
}
