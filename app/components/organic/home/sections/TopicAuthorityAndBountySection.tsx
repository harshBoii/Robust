import Link from 'next/link';
import { RevenueChip } from '@/app/components/geo/revenue-chip';
import { formatUsd } from '@/app/components/organic/home/utils/format-metric';
import type { TopicAuthorityRowView } from '@/app/components/organic/home/utils/topic-authority';

type BountyRow = {
  id: string;
  query: string;
  companyName?: string | null;
  suggestedCluster?: string | null;
  priorityScore: number;
  estimatedReach?: number | null;
  estimatedRevenue?: number | null;
  revenueBreakdown?: {
    monthlyPromptReach?: number | null;
    visibilityWeight?: number | null;
    ctr?: number | null;
    cvr?: number | null;
    aov?: number | null;
  } | null;
};

function scoreStyle(score: number) {
  if (score >= 70) {
    return {
      background: 'oklch(0.52 0.18 145 / 0.15)',
      color: 'oklch(0.38 0.16 145)',
      borderColor: 'oklch(0.52 0.18 145 / 0.30)',
      bar: 'oklch(0.52 0.18 145)',
    };
  }
  if (score >= 40) {
    return {
      background: 'oklch(0.68 0.18 72 / 0.15)',
      color: 'oklch(0.44 0.16 72)',
      borderColor: 'oklch(0.68 0.18 72 / 0.28)',
      bar: 'oklch(0.68 0.18 72)',
    };
  }
  return {
    background: 'oklch(0.52 0.03 240 / 0.12)',
    color: 'var(--muted-foreground)',
    borderColor: 'oklch(0.52 0.03 240 / 0.20)',
    bar: 'var(--sibling-accent)',
  };
}

export function TopicAuthorityAndBountySection({
  topicAuthorityRows,
  bountyPriorityTopByRevenue,
  bountyTop3Combined,
}: {
  topicAuthorityRows: TopicAuthorityRowView[];
  bountyPriorityTopByRevenue: BountyRow[];
  bountyTop3Combined: { reach: number; revenue: number };
}) {
  const hasTopicAuthority = topicAuthorityRows.length > 0;
  const hasBounties = bountyPriorityTopByRevenue.length > 0;
  if (!hasTopicAuthority && !hasBounties) return null;

  return (
    <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      {hasTopicAuthority && (
        <div className="glass-card card-anime-float rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground font-heading">Topic Authority</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Prompts hunted (AEO) vs tracked · score 10–100</p>
          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto glass-scrollbar pr-1">
            {topicAuthorityRows.map((t) => {
              const style = scoreStyle(t.score);
              return (
                <div key={t.topicId} className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/60 px-3 py-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <p className="font-medium text-foreground truncate">{t.topicName}</p>
                        {t.companyName ? (
                          <span className="shrink-0 rounded-full border border-[var(--sibling-primary)]/35 bg-[color-mix(in_srgb,var(--sibling-primary)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sibling-primary)]">
                            {t.companyName}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {t.hunted}/{t.total} prompts hunted
                        <span className="mx-1 opacity-40">·</span>
                        {t.difficulty} difficulty
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{ background: style.background, color: style.color, border: '1px solid', borderColor: style.borderColor }}
                    >
                      {t.score}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--glass-border)]/60">
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${t.completionPct}%`, background: style.bar }} />
                    </div>
                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground w-8 text-right">{t.completionPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasBounties && (
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--sibling-surface,hsl(224,24%,12%))] p-5 text-[hsl(220,22%,94%)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sibling-accent)]">Bounty Priorities</p>
          <p className="mt-1 text-xs text-[hsl(220,16%,78%)]">
            Ranked by est. revenue (top 3). Combined reach {bountyTop3Combined.reach.toLocaleString()} · combined est.{' '}
            {formatUsd(bountyTop3Combined.revenue)}
          </p>
          <div className="mt-4 space-y-3">
            {bountyPriorityTopByRevenue.map((b) => (
              <div key={b.id} className="rounded-lg border border-white/12 bg-[hsl(226,22%,16%)]/90 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold leading-snug line-clamp-2 text-[hsl(220,24%,96%)]">{b.query}</p>
                    {b.companyName ? (
                      <span className="inline-block rounded-full border border-[hsl(160,45%,45%)]/45 bg-[hsl(160,35%,22%)]/90 px-2 py-0.5 text-[10px] font-semibold text-[hsl(160,55%,72%)]">{b.companyName}</span>
                    ) : null}
                  </div>
                  {b.suggestedCluster ? (
                    <span className="shrink-0 rounded-full border border-[var(--sibling-accent)]/50 bg-[var(--sibling-accent)]/18 px-2 py-0.5 text-[10px] font-medium text-[hsl(160,55%,72%)]">{b.suggestedCluster}</span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[hsl(220,14%,72%)]">
                    <span>Score <span className="tabular-nums text-[hsl(220,20%,88%)]">{Math.round(b.priorityScore)}</span></span>
                    {b.estimatedReach != null && (
                      <span>Reach <span className="tabular-nums text-[hsl(220,20%,88%)]">{b.estimatedReach.toLocaleString()}</span></span>
                    )}
                  </div>
                  {b.estimatedRevenue != null && Number.isFinite(b.estimatedRevenue) ? (
                    <RevenueChip amount={b.estimatedRevenue} tooltipTitle="Bounty revenue estimate" size="sm" className="shrink-0" breakdown={b.revenueBreakdown ?? undefined} />
                  ) : (
                    <span className="text-[10px] text-[hsl(220,12%,58%)]">Est. revenue —</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link href="/geo/bounty" className="mt-4 inline-flex text-xs font-semibold text-[hsl(160,50%,58%)] hover:text-[hsl(160,48%,68%)] hover:underline">
            View all bounties →
          </Link>
        </div>
      )}
    </section>
  );
}
