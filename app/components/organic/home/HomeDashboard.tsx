'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { GeoKnightWorkspaceData } from '@/lib/geo/geoknight/loadGeoKnightTopicViews';
import type { CitationContextRow } from '@/lib/geo/radar/aggregateCitationContext';
import type { HighlightPrompt } from '@/lib/geo/report/pick-highlight-prompts';
import { RadarCompareCharts } from '@/app/components/organic/home/sov-charts';
import type { CitationRow } from '@/app/components/organic/home/CitationsTable';
import { HomeDashboardHeader } from '@/app/components/organic/home/sections/HomeDashboardHeader';
import { StatCardsSection } from '@/app/components/organic/home/sections/StatCardsSection';
import { TopicAuthorityAndBountySection } from '@/app/components/organic/home/sections/TopicAuthorityAndBountySection';
import { CitationsAndRadarSection } from '@/app/components/organic/home/sections/CitationsAndRadarSection';
import { HomeDashboardFooter, HomeDashboardLiveBar } from '@/app/components/organic/home/sections/HomeDashboardFooter';
import { buildTopicAuthorityRows } from '@/app/components/organic/home/utils/topic-authority';

type RadarPayload = Awaited<
  ReturnType<typeof import('@/lib/geo/radar/buildRadarGetPayload').buildRadarGetPayload>
>;

export default function HomeDashboard({
  payload,
  geoKnight,
  rivalsForCharts,
  sparkSeries,
  contextRows: _contextRows,
  highlightPrompts: _highlightPrompts,
  recentCitations,
  useOrgRadarCharts = false,
}: {
  payload: RadarPayload;
  geoKnight: GeoKnightWorkspaceData;
  rivalsForCharts: Array<{ id: string; name: string }>;
  sparkSeries: { sov: number[]; top3: number[]; coverage: number[]; rank: number[] };
  contextRows: CitationContextRow[];
  highlightPrompts: HighlightPrompt[];
  recentCitations: CitationRow[];
  useOrgRadarCharts?: boolean;
}) {
  const ourName = payload.company?.name?.trim() ?? 'Your company';
  const latest = payload.latest;

  const activePromptCount = useMemo(
    () => geoKnight.topicViews.reduce((s, t) => s + t.prompts.length, 0),
    [geoKnight.topicViews],
  );

  const hasRadarMetrics = payload.metrics.length > 0;
  const hasIntel = payload.citationIntelligence.length > 0;
  const hasBounties = payload.bountyPriority.open.length > 0;
  const hasTopicAuthority = payload.topicAuthorityMap.length > 0;
  const hasAnyData = hasRadarMetrics || hasIntel || hasBounties;

  const bountyPriorityTopByRevenue = useMemo(() => {
    const copy = [...payload.bountyPriority.open];
    copy.sort((a, b) => {
      const ar = a.estimatedRevenue ?? -Infinity;
      const br = b.estimatedRevenue ?? -Infinity;
      if (br !== ar) return br - ar;
      return (b.estimatedReach ?? 0) - (a.estimatedReach ?? 0);
    });
    return copy.slice(0, 3);
  }, [payload.bountyPriority.open]);

  const bountyTop3Combined = useMemo(() => ({
    reach: bountyPriorityTopByRevenue.reduce((s, b) => s + (b.estimatedReach ?? 0), 0),
    revenue: bountyPriorityTopByRevenue.reduce((s, b) => s + (b.estimatedRevenue ?? 0), 0),
  }), [bountyPriorityTopByRevenue]);

  const topicAuthorityRows = useMemo(
    () => buildTopicAuthorityRows(payload.topicAuthorityMap, geoKnight),
    [payload.topicAuthorityMap, geoKnight],
  );

  const radarChartData = useMemo(() => {
    if (!latest) return [];
    const avgWinRate =
      payload.citationIntelligence.length > 0
        ? payload.citationIntelligence.reduce((s, r) => s + r.winRate, 0) / payload.citationIntelligence.length
        : 0;
    return [
      { subject: 'SoV', value: latest.shareOfVoice ?? 0, fullMark: 100 },
      { subject: 'Top-3', value: latest.top3Rate ?? 0, fullMark: 100 },
      { subject: 'Coverage', value: latest.queryCoverage ?? 0, fullMark: 100 },
      { subject: 'Win Rate', value: avgWinRate, fullMark: 100 },
      { subject: 'Rank Score', value: Math.max(0, 100 - (latest.competitorRank ?? 50) * 10), fullMark: 100 },
    ];
  }, [latest, payload.citationIntelligence]);

  const calculatedDate = latest?.calculatedAt
    ? new Date(latest.calculatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-[60vh] min-w-0 pb-10 pt-2 print:px-6">
      <HomeDashboardHeader calculatedDate={calculatedDate} />

      {!hasAnyData && (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)] p-8 text-center text-sm text-muted-foreground">
          No intelligence data yet. Click <strong>Refresh data</strong> above, or add topics in{' '}
          <Link href="/geo/geoknight" className="font-semibold text-[var(--sibling-primary)] hover:underline">
            GeoKnight
          </Link>
          .
        </div>
      )}

      {hasRadarMetrics && (
        <StatCardsSection latest={latest} top3BenchmarkPct={payload.top3BenchmarkPct} sparkSeries={sparkSeries} />
      )}

      {hasRadarMetrics && !useOrgRadarCharts && (
        <section className="mt-6 min-w-0">
          <RadarCompareCharts
            base={{ sovSeries: payload.sovSeries, modelBreakdown: payload.modelBreakdown, promptsByModel: payload.promptsByModel }}
            rivals={rivalsForCharts}
          />
        </section>
      )}

      <TopicAuthorityAndBountySection
        topicAuthorityRows={topicAuthorityRows}
        bountyPriorityTopByRevenue={bountyPriorityTopByRevenue}
        bountyTop3Combined={bountyTop3Combined}
      />

      <CitationsAndRadarSection
        recentCitations={recentCitations}
        ourName={ourName}
        radarChartData={hasRadarMetrics ? radarChartData : []}
        metrics={payload.metrics}
      />

      {hasAnyData && <HomeDashboardFooter />}
      {hasAnyData && (
        <HomeDashboardLiveBar
          activePromptCount={activePromptCount}
          topicNodeCount={payload.topicAuthorityMap.length}
          calculatedDate={calculatedDate}
        />
      )}
    </div>
  );
}
