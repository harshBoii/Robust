export type CitationContextRow = { label: string; count: number; pct: number };

/** Aggregate context labels across citation-intelligence rows. */
export function aggregateCitationContextFromIntel(
  rows: ReadonlyArray<{
    contextDistribution: ReadonlyArray<{ label: string; count: number }>;
  }>,
): CitationContextRow[] {
  const contextAgg = new Map<string, number>();
  for (const row of rows) {
    for (const c of row.contextDistribution) {
      contextAgg.set(c.label, (contextAgg.get(c.label) ?? 0) + c.count);
    }
  }
  const ctxTotal = [...contextAgg.values()].reduce((a, b) => a + b, 0);
  return [...contextAgg.entries()]
    .map(([label, count]) => ({
      label,
      count,
      pct: ctxTotal > 0 ? Math.round((count / ctxTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
