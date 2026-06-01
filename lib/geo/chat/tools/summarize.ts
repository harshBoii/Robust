import type { BountyWorkspaceData } from '@/lib/geo/bounty/loadBountyWorkspaceData';
import type { BountyPageRecord } from '@/lib/geo/bounty/loadBountyPagesData';
import type { GeoKnightWorkspaceData } from '@/lib/geo/geoknight/loadGeoKnightTopicViews';
import type { loadOrganicHomeData } from '@/lib/organic/home/loadOrganicHomeData';

export function summarizeDashboard(data: Awaited<ReturnType<typeof loadOrganicHomeData>>) {
  const { payload, recentCitations, highlightPrompts } = data;
  const latest = payload.latest;
  return {
    company: payload.company,
    summaryCards: payload.summaryCards,
    latestMetrics: latest
      ? {
          shareOfVoice: latest.shareOfVoice,
          top3Rate: latest.top3Rate,
          queryCoverage: latest.queryCoverage,
          competitorRank: latest.competitorRank,
          calculatedAt: latest.calculatedAt,
        }
      : null,
    bountyPriorityTop5: (payload.bountyPriority?.open ?? []).slice(0, 5),
    citationIntelligenceTop10: (payload.citationIntelligence ?? []).slice(0, 10),
    recentCitations: recentCitations.slice(0, 8),
    highlightPrompts: highlightPrompts.slice(0, 5),
    actionQueueCount: payload.actionQueue?.length ?? 0,
  };
}

export function summarizeGeoKnight(
  data: GeoKnightWorkspaceData,
  opts?: { topicId?: string; difficulty?: string; limit?: number },
) {
  const limit = opts?.limit ?? 15;
  let topics = data.topicViews;
  if (opts?.topicId) topics = topics.filter((t) => t.id === opts.topicId);
  if (opts?.difficulty) {
    const d = opts.difficulty.toUpperCase();
    topics = topics.filter((t) => t.difficulty === d);
  }

  const topPrompts = topics
    .flatMap((t) =>
      t.prompts.map((p) => ({
        topicName: t.name,
        topicId: t.id,
        difficulty: t.difficulty,
        id: p.id,
        query: p.query,
        estimatedRevenue: p.revenue?.estimatedRevenue ?? null,
        ishunted: p.ishunted,
        avgRank: p.consensus[0]?.avgRank ?? null,
      })),
    )
    .sort((a, b) => (b.estimatedRevenue ?? 0) - (a.estimatedRevenue ?? 0))
    .slice(0, limit);

  return {
    companyName: data.companyName,
    topicCount: topics.length,
    totalPrompts: topics.reduce((s, t) => s + t.prompts.length, 0),
    rivals: data.rivals,
    topPrompts,
    rawTruncated: data.topicViews.length > topics.length || topPrompts.length >= limit,
  };
}

export function summarizeBounty(data: BountyWorkspaceData) {
  const uncitedPrompts = data.niches
    .flatMap((n) =>
      n.prompts.map((p) => ({
        niche: n.topic,
        nicheId: n.id,
        promptId: p.id,
        query: p.query,
        resolvedRevenue: p.resolvedRevenue,
        difficulty: n.difficulty,
      })),
    )
    .sort((a, b) => b.resolvedRevenue - a.resolvedRevenue)
    .slice(0, 15);

  return {
    summary: data.summary,
    topNichesByRevenue: [...data.niches]
      .sort((a, b) => b.topicEstimatedRevenue - a.topicEstimatedRevenue)
      .slice(0, 8)
      .map((n) => ({
        id: n.id,
        topic: n.topic,
        difficulty: n.difficulty,
        topicEstimatedRevenue: n.topicEstimatedRevenue,
        prompt_count: n.prompt_count,
      })),
    topUncitedPrompts: uncitedPrompts,
    rawTruncated: data.niches.length > 8,
  };
}

export function summarizeBountyPages(bounties: BountyPageRecord[]) {
  return {
    count: bounties.length,
    bounties: bounties.slice(0, 12).map((b) => ({
      id: b.id,
      query: b.query,
      status: b.status,
      aeoPage: b.aeoPage
        ? {
            id: b.aeoPage.id,
            title: b.aeoPage.title,
            status: b.aeoPage.status,
            canonicalUrl: b.aeoPage.canonicalUrl,
            publishedAt: b.aeoPage.publishedAt,
          }
        : null,
      contents: b.contents.map((c) => ({
        id: c.id,
        platform: c.platform,
        status: c.status,
        title: c.title,
        publishedUrl: c.publishedUrl,
      })),
    })),
    rawTruncated: bounties.length > 12,
  };
}
