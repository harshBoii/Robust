import { MiniSpark } from '@/app/components/organic/home/metric-sparklines';
import { formatMetric } from '@/app/components/organic/home/utils/format-metric';

type LatestMetrics = {
  shareOfVoice?: number | null;
  top3Rate?: number | null;
  queryCoverage?: number | null;
  competitorRank?: number | null;
  avgRank?: number | null;
};

export function StatCardsSection({
  latest,
  top3BenchmarkPct,
  sparkSeries,
}: {
  latest: LatestMetrics | null | undefined;
  top3BenchmarkPct: number;
  sparkSeries: { sov: number[]; top3: number[]; coverage: number[]; rank: number[] };
}) {
  const cards = [
    {
      label: 'SHARE OF VOICE',
      value: formatMetric(latest?.shareOfVoice, { suffix: '%', digits: 1 }),
      note: 'Relative mentions',
      spark: sparkSeries.sov,
      stroke: 'var(--sibling-primary)',
    },
    {
      label: 'TOP-3 MENTION RATE',
      value: formatMetric(latest?.top3Rate, { suffix: '%', digits: 0 }),
      note: `Benchmark ~${top3BenchmarkPct}%`,
      spark: sparkSeries.top3,
      stroke: '#22c55e',
    },
    {
      label: 'QUERY COVERAGE',
      value: formatMetric(latest?.queryCoverage, { suffix: '%', digits: 1 }),
      note: 'Tracked queries',
      spark: sparkSeries.coverage,
      stroke: '#3b82f6',
    },
    {
      label: 'RANK VS COMPETITORS',
      value: formatMetric(latest?.competitorRank, { prefix: '#', digits: 1 }),
      note: `Avg #${formatMetric(latest?.avgRank, { digits: 1 })}`,
      spark: sparkSeries.rank,
      stroke: 'var(--sibling-accent)',
    },
  ];

  return (
    <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="glass-card card-anime-float flex min-w-0 flex-col rounded-xl border border-[var(--glass-border)] p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground tabular-nums tracking-tight">
            {card.value}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{card.note}</p>
          <MiniSpark data={card.spark} stroke={card.stroke} />
        </div>
      ))}
    </section>
  );
}
