export function formatMetric(
  value: number | null | undefined,
  opts: { suffix?: string; prefix?: string; digits?: number } = {},
) {
  const { suffix = '', prefix = '', digits = 1 } = opts;
  if (value == null || Number.isNaN(value)) return '—';
  return `${prefix}${Number(value).toFixed(digits)}${suffix}`;
}

export function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M/mo`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}k/mo`;
  return `$${Math.round(value).toLocaleString()}/mo`;
}

export function matchesSearch(q: string, ...parts: (string | null | undefined)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => (p ?? '').toLowerCase().includes(needle));
}
