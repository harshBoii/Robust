import type { PrismaClient } from '@/app/generated/prisma/client';
import { DEFAULT_CTR, DEFAULT_CVR, TOP3_BENCHMARK_PCT } from '@/lib/geo/constants';
import {
  aggregatePromptStats,
  topicAuthorityFromRollup,
  type ExecutionLite,
  type PromptCitationStats,
} from '@/lib/geo/citationAnalytics';
import {
  bountyPriorityScore,
  computeBountyEstimatedRevenue,
  effectiveBountyConversionRate,
} from '@/lib/geo/bountyRevenue';
import { medianCompanyAovFromProducts } from '@/lib/geo/shopifyAov';
import {
  maxPromptRevenueByQuery,
  mergeBountyEstimatesByNormalizedQuery,
  normalizePromptQuery,
  resolveBountyRevenueUsd,
  revenueBreakdownForBountyQuery,
} from '@/lib/geo/promptRevenueResolve';

function normalizePercentMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return value <= 1 ? value * 100 : value;
}

function companyScopeWhere(ids: readonly string[]) {
  if (ids.length === 0) throw new Error('buildRadarGetPayload: at least one company id required');
  if (ids.length === 1) return { companyId: ids[0]! };
  return { companyId: { in: [...ids] } };
}

export async function buildRadarGetPayload(
  prisma: PrismaClient,
  companyIdOrIds: string | readonly string[],
) {
  const rawIds = typeof companyIdOrIds === 'string' ? [companyIdOrIds] : [...companyIdOrIds];
  const ids = [...new Set(rawIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw new Error('buildRadarGetPayload: at least one company id required');
  }
  const cw = companyScopeWhere(ids);
  const scale = Math.min(8, Math.max(1, ids.length));
  const takeRadarMetrics = Math.min(480, 60 * scale);
  const takeOpenBounties = Math.min(400, 100 * scale);
  const takeLlmTopics = Math.min(400, 50 * scale);
  const takePromptMetrics = Math.min(800, 200 * scale);
  const takeHuntedTiming = Math.min(160, 40 * scale);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    companyRows,
    assumption,
    products,
    metricsRaw,
    openBounties,
    huntedRecent,
    promptIdsFromCites,
    promptIdsFromRivals,
    topicPrompts,
    llmTopics,
    promptsByModelAgg,
    promptMetrics,
    allBountiesForRevenue,
  ] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    }),
    prisma.radarAssumption.findFirst({ where: cw }),
    prisma.shopifyProduct.findMany({
      where: cw,
      select: { priceMinAmount: true, priceMaxAmount: true },
    }),
    prisma.llmRadarMetric.findMany({
      where: cw,
      orderBy: { calculatedAt: 'desc' },
      take: takeRadarMetrics,
    }),
    prisma.citationBounty.findMany({
      where: { ...cw, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: takeOpenBounties,
    }),
    prisma.citationBounty.findMany({
      where: {
        ...cw,
        status: 'HUNTED',
        publishedAt: { gte: thirtyDaysAgo },
      },
      select: { estimatedRevenue: true },
    }),
    prisma.citation.findMany({
      where: cw,
      select: { execution: { select: { promptId: true } } },
    }),
    prisma.promptRivalConsensus.findMany({
      where: { prompt: { llmTopic: cw } },
      select: { promptId: true },
      distinct: ['promptId'],
    }),
    prisma.prompt.findMany({
      where: { llmTopic: cw },
      select: { id: true },
    }),
    prisma.llmTopic.findMany({
      where: cw,
      orderBy: { createdAt: 'desc' },
      take: takeLlmTopics,
    }),
    prisma.llmPromptMetric.groupBy({
      by: ['model'],
      where: cw,
      _count: { promptId: true },
      orderBy: { _count: { promptId: 'desc' } },
    }),
    prisma.llmPromptMetric.findMany({
      where: cw,
      include: {
        prompt: { select: { id: true, query: true } },
        llmTopic: { select: { name: true } },
      },
      orderBy: { calculatedAt: 'desc' },
      take: takePromptMetrics,
    }),
    prisma.citationBounty.findMany({
      where: cw,
      select: { query: true, estimatedRevenue: true },
    }),
  ]);

  const nameById = new Map(companyRows.map((c) => [c.id, c.name]));
  const company =
    companyRows.length === 0
      ? null
      : companyRows.length === 1
        ? companyRows[0]!
        : {
            id: ids[0]!,
            name: ids
              .map((id) => nameById.get(id))
              .filter((n): n is string => Boolean(n?.trim()))
              .join(' · '),
          };

  const topicPromptIds = topicPrompts.map((p) => p.id);
  const promptsWithRevenueForBounty = await prisma.prompt.findMany({
    where: {
      isActive: true,
      OR: [
        ...(topicPromptIds.length > 0 ? [{ id: { in: topicPromptIds } }] : []),
        { llmTopic: cw },
      ],
    },
    select: {
      id: true,
      query: true,
      revenue: {
        select: {
          estimatedRevenue: true,
          monthlyPromptReach: true,
          visibilityWeight: true,
          ctr: true,
          cvr: true,
          aov: true,
        },
      },
    },
  });

  const promptRevenueByQuery = maxPromptRevenueByQuery(
    promptsWithRevenueForBounty.map((p) => ({ query: p.query, revenue: p.revenue })),
  );
  const bountyEstByNorm = mergeBountyEstimatesByNormalizedQuery(allBountiesForRevenue);

  const huntedForTiming = await prisma.citationBounty.findMany({
    where: { ...cw, status: 'HUNTED', huntedAt: { not: null } },
    take: takeHuntedTiming,
    select: { huntedAt: true, publishedAt: true },
  });
  const timingSamples = huntedForTiming.filter((b) => b.publishedAt && b.huntedAt);
  const avgHoursToPublish =
    timingSamples.length > 0
      ? timingSamples.reduce((s, b) => {
          const ms = b.publishedAt!.getTime() - b.huntedAt!.getTime();
          return s + ms / 3600000;
        }, 0) / timingSamples.length
      : null;

  const aovProxy = medianCompanyAovFromProducts(
    products.map((p) => ({
      priceMinAmount: p.priceMinAmount != null ? String(p.priceMinAmount) : null,
      priceMaxAmount: p.priceMaxAmount != null ? String(p.priceMaxAmount) : null,
    })),
    75,
  );

  const assumptions = {
    ctr: assumption?.ctr ?? DEFAULT_CTR,
    cvr: assumption?.cvr ?? DEFAULT_CVR,
    aovProxy,
    aovMultiplier: assumption?.aovMultiplier ?? 1,
    industryPreset: assumption?.industryPreset ?? null,
  };

  const promptIdSet = new Set<string>();
  for (const c of promptIdsFromCites) promptIdSet.add(c.execution.promptId);
  for (const r of promptIdsFromRivals) promptIdSet.add(r.promptId);
  for (const p of topicPrompts) promptIdSet.add(p.id);
  const mergedPromptIds = [...promptIdSet];

  const citationIntel: PromptCitationStats[] = [];
  if (mergedPromptIds.length > 0) {
    const execsRaw = await prisma.promptExecution.findMany({
      where: { promptId: { in: mergedPromptIds } },
      include: {
        citations: {
          select: { companyId: true, rank: true, context: true },
        },
      },
    });

    const byPrompt = new Map<string, ExecutionLite[]>();
    for (const e of execsRaw) {
      const list = byPrompt.get(e.promptId) ?? [];
      list.push({
        id: e.id,
        model: e.model,
        executedAt: e.executedAt,
        promptId: e.promptId,
        citations: e.citations,
      });
      byPrompt.set(e.promptId, list);
    }

    const promptsMeta = await prisma.prompt.findMany({
      where: { id: { in: mergedPromptIds } },
      include: { llmTopic: { select: { id: true, name: true, difficulty: true } } },
    });

    const ownScope: string | readonly string[] = ids.length === 1 ? ids[0]! : ids;
    for (const p of promptsMeta) {
      const rows = byPrompt.get(p.id) ?? [];
      citationIntel.push(
        aggregatePromptStats(
          p.id,
          p.query,
          p.llmTopic?.id ?? null,
          p.llmTopic?.name ?? null,
          p.llmTopic?.difficulty ?? null,
          rows,
          ownScope,
        ),
      );
    }
    citationIntel.sort((a, b) => a.winRate - b.winRate);
  }

  const catalogAov = aovProxy;
  const bountyPriorityRows = openBounties
    .map((b) => {
      const priorityScore = bountyPriorityScore({
        estimatedReach: b.estimatedReach,
        confidence: b.confidence,
        difficulty: b.difficulty,
      });
      const conv = effectiveBountyConversionRate(b.conversionRate);
      const aov = b.avgOrderValue ?? catalogAov;
      const funnelFallback = computeBountyEstimatedRevenue({
        estimatedReach: b.estimatedReach,
        conversionRate: conv,
        avgOrderValue: aov,
      });
      const resolved = resolveBountyRevenueUsd({
        query: b.query,
        bountyEstimatedRevenue: bountyEstByNorm.get(normalizePromptQuery(b.query)) ?? null,
        promptRevenueByQuery,
      });
      const estRev =
        resolved > 0
          ? resolved
          : funnelFallback ??
            (b.estimatedRevenue != null && Number.isFinite(b.estimatedRevenue)
              ? b.estimatedRevenue
              : null);
      const revenueBreakdown = revenueBreakdownForBountyQuery(
        promptsWithRevenueForBounty,
        b.query,
      );
      return {
        id: b.id,
        query: b.query,
        status: b.status,
        estimatedReach: b.estimatedReach,
        confidence: b.confidence,
        difficulty: b.difficulty,
        suggestedCluster: b.suggestedCluster,
        priorityScore,
        estimatedRevenue: estRev,
        revenueBreakdown,
        conversionRate: b.conversionRate ?? conv,
        avgOrderValue: aov,
        ...(ids.length > 1 ? { companyName: nameById.get(b.companyId) ?? null } : {}),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const top5Open = bountyPriorityRows.slice(0, 5);
  const top5CombinedReach = top5Open.reduce((s, b) => s + (b.estimatedReach ?? 0), 0);
  const top5CombinedEstimatedRevenue = top5Open.reduce(
    (s, b) => s + (b.estimatedRevenue ?? 0),
    0,
  );

  const clusterMap = new Map<
    string,
    { count: number; sumReach: number; sumEstimatedRevenue: number; prioritySum: number }
  >();
  for (const b of bountyPriorityRows) {
    const key = b.suggestedCluster?.trim() || 'uncategorized';
    const cur = clusterMap.get(key) ?? {
      count: 0,
      sumReach: 0,
      sumEstimatedRevenue: 0,
      prioritySum: 0,
    };
    cur.count += 1;
    cur.sumReach += b.estimatedReach ?? 0;
    cur.sumEstimatedRevenue += b.estimatedRevenue ?? 0;
    cur.prioritySum += b.priorityScore;
    clusterMap.set(key, cur);
  }
  const clusters = [...clusterMap.entries()].map(([suggestedCluster, v]) => ({
    suggestedCluster,
    count: v.count,
    sumReach: v.sumReach,
    sumEstimatedRevenue: v.sumEstimatedRevenue,
    avgPriority: v.count ? v.prioritySum / v.count : 0,
  }));

  const topicRollupsMap = new Map<
    string,
    {
      topicId: string;
      topicName: string;
      difficulty: string;
      prompts: PromptCitationStats[];
      opportunitySum: number;
      revenueSum: number;
    }
  >();

  for (const row of citationIntel) {
    if (!row.topicId) continue;
    const cur = topicRollupsMap.get(row.topicId) ?? {
      topicId: row.topicId,
      topicName: row.topicName ?? '',
      difficulty: String(row.topicDifficulty ?? 'MEDIUM'),
      prompts: [],
      opportunitySum: 0,
      revenueSum: 0,
    };
    cur.prompts.push(row);
    topicRollupsMap.set(row.topicId, cur);
  }

  for (const m of promptMetrics) {
    if (!m.topicId) continue;
    const cur = topicRollupsMap.get(m.topicId);
    if (cur) {
      cur.opportunitySum += m.opportunityScore ?? 0;
      cur.revenueSum += m.estimatedRevenue ?? 0;
    }
  }

  const topicRollups = [...topicRollupsMap.values()].map((t) => {
    const winAvg =
      t.prompts.length > 0 ? t.prompts.reduce((s, p) => s + p.winRate, 0) / t.prompts.length : 0;
    const wrsAvg =
      t.prompts.length > 0 ? t.prompts.reduce((s, p) => s + p.wrs, 0) / t.prompts.length : 0;
    const modelAgreeMax = t.prompts.reduce((m, p) => Math.max(m, p.modelsCitingCount), 0);
    return {
      topicId: t.topicId,
      topicName: t.topicName,
      difficulty: t.difficulty,
      promptCount: t.prompts.length,
      avgWinRate: winAvg,
      avgWrs: wrsAvg,
      maxModelsCiting: modelAgreeMax,
      opportunitySum: t.opportunitySum,
      revenueSum: t.revenueSum,
    };
  });

  const topicAuthorityMap = llmTopics.map((t) => {
    const base = topicAuthorityFromRollup(t.id, t.name, t.difficulty, citationIntel);
    if (ids.length <= 1) return base;
    return {
      ...base,
      companyName: nameById.get(t.companyId) ?? null,
    };
  });

  const publishedImpact30d = huntedRecent.reduce((s, h) => s + (h.estimatedRevenue ?? 0), 0);

  const revenueOpportunity30d = [...promptMetrics]
    .sort((a, b) => (b.estimatedRevenue ?? 0) - (a.estimatedRevenue ?? 0))
    .slice(0, 10)
    .reduce((s, m) => s + (m.estimatedRevenue ?? 0), 0);

  const lowWinPrompts = citationIntel.filter((p) => p.winRate < 40);
  const reachRisk =
    lowWinPrompts.length > 0
      ? bountyPriorityRows
          .filter((b) =>
            lowWinPrompts.some((p) => p.query.toLowerCase() === b.query.trim().toLowerCase()),
          )
          .reduce((s, b) => s + (b.estimatedRevenue ?? 0), 0)
      : 0;
  const revenueAtRisk30d =
    reachRisk > 0
      ? Math.round(reachRisk)
      : Math.round(bountyPriorityRows.reduce((s, b) => s + (b.estimatedRevenue ?? 0), 0) * 0.15);

  const quickWinsCount = bountyPriorityRows.filter(
    (b) => b.difficulty === 'EASY' && (b.estimatedReach ?? 0) >= 500,
  ).length;

  const modelGapCount = citationIntel.filter(
    (p) => p.distinctModelTotal > 1 && p.modelsCitingCount < p.distinctModelTotal,
  ).length;

  const latestRow =
    metricsRaw.find(
      (m) =>
        (m.shareOfVoice != null && m.shareOfVoice > 0) ||
        (m.top3Rate != null && m.top3Rate > 0) ||
        (m.queryCoverage != null && m.queryCoverage > 0) ||
        m.competitorRank != null ||
        m.topicAuthority != null,
    ) ?? metricsRaw[0];

  const sovSeries = [...metricsRaw]
    .sort((a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime())
    .map((m) => ({
      id: m.id,
      model: m.model,
      calculatedAt: m.calculatedAt.toISOString(),
      shareOfVoice: normalizePercentMetric(m.shareOfVoice),
      top3Rate: normalizePercentMetric(m.top3Rate),
      queryCoverage: normalizePercentMetric(m.queryCoverage),
      avgRank: m.avgRank,
      competitorRank: m.competitorRank,
      topicAuthority: m.topicAuthority,
    }));

  const modelBreakdownMap = new Map<
    string,
    { sumSov: number; count: number; top3: number; coverage: number }
  >();
  for (const m of metricsRaw) {
    const cur = modelBreakdownMap.get(m.model) ?? { sumSov: 0, count: 0, top3: 0, coverage: 0 };
    cur.count += 1;
    cur.sumSov += normalizePercentMetric(m.shareOfVoice) ?? 0;
    cur.top3 += normalizePercentMetric(m.top3Rate) ?? 0;
    cur.coverage += normalizePercentMetric(m.queryCoverage) ?? 0;
    modelBreakdownMap.set(m.model, cur);
  }
  const modelBreakdown = [...modelBreakdownMap.entries()].map(([model, v]) => ({
    model,
    avgShareOfVoice: v.count ? v.sumSov / v.count : 0,
    avgTop3Rate: v.count ? v.top3 / v.count : 0,
    avgQueryCoverage: v.count ? v.coverage / v.count : 0,
  }));

  const promptsByModel = promptsByModelAgg.map((g) => ({
    model: g.model,
    count: g._count.promptId,
  }));

  const actionQueueDedup = new Map<
    string,
    {
      promptId: string;
      query: string;
      topicName: string | null;
      model: string;
      latestRank: number | null;
      isMentioned: boolean;
      estimatedReach: number | null;
      estimatedRevenue: number | null;
      opportunityScore: number | null;
      actionType: string | null;
      recommendedCta: string;
      sortKey: number;
    }
  >();
  for (const row of promptMetrics) {
    const key = `${row.promptId}:${row.model}`;
    const combinedScore = (row.estimatedRevenue ?? 0) * ((row.opportunityScore ?? 0) / 100);
    const sortKey = Number.isFinite(combinedScore) ? combinedScore : 0;
    const prev = actionQueueDedup.get(key);
    if (!prev || sortKey > prev.sortKey) {
      actionQueueDedup.set(key, {
        promptId: row.promptId,
        query: row.prompt.query,
        topicName: row.llmTopic?.name ?? null,
        model: row.model,
        latestRank: row.latestRank,
        isMentioned: row.isMentioned,
        estimatedReach: row.estimatedReach,
        estimatedRevenue: row.estimatedRevenue,
        opportunityScore: row.opportunityScore,
        actionType: row.actionType,
        recommendedCta: inferCta(row.actionType),
        sortKey,
      });
    }
  }
  const actionQueueSorted = [...actionQueueDedup.values()]
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 15)
    .map((row) => {
      const { sortKey: _rank, ...rest } = row;
      void _rank;
      return rest;
    });

  return {
    company: company ?? null,
    assumptions,
    summaryCards: {
      revenueAtRisk30d: Math.round(revenueAtRisk30d),
      revenueOpportunity30d: Math.round(revenueOpportunity30d),
      quickWinsCount,
      publishedImpact30d: Math.round(publishedImpact30d),
      modelGapCount,
    },
    latest: latestRow
      ? {
          shareOfVoice: normalizePercentMetric(latestRow.shareOfVoice),
          top3Rate: normalizePercentMetric(latestRow.top3Rate),
          queryCoverage: normalizePercentMetric(latestRow.queryCoverage),
          competitorRank: latestRow.competitorRank,
          topicAuthority: latestRow.topicAuthority,
          avgRank: latestRow.avgRank,
          calculatedAt: latestRow.calculatedAt.toISOString(),
        }
      : null,
    metrics: metricsRaw.slice(0, 20).map((m) => ({
      id: m.id,
      model: m.model,
      shareOfVoice: normalizePercentMetric(m.shareOfVoice),
      top3Rate: normalizePercentMetric(m.top3Rate),
      queryCoverage: normalizePercentMetric(m.queryCoverage),
      competitorRank: m.competitorRank,
      topicAuthority: m.topicAuthority,
      avgRank: m.avgRank,
      calculatedAt: m.calculatedAt.toISOString(),
    })),
    sovSeries,
    modelBreakdown,
    promptsByModel,
    top3BenchmarkPct: TOP3_BENCHMARK_PCT,
    citationIntelligence: citationIntel.slice(0, 80).map((c) => ({
      promptId: c.promptId,
      query: c.query,
      executionCount: c.executionCount,
      winRate: Math.round(c.winRate * 10) / 10,
      wrs: Math.round(c.wrs * 100) / 100,
      modelsCitingCount: c.modelsCitingCount,
      distinctModelTotal: c.distinctModelTotal,
      contextDistribution: c.contextDistribution,
    })),
    topicRollups,
    topicAuthorityMap: topicAuthorityMap.slice(0, 30),
    bountyPriority: {
      open: bountyPriorityRows.slice(0, 25),
      top5CombinedReach,
      top5CombinedEstimatedRevenue: Math.round(top5CombinedEstimatedRevenue),
      clusters,
    },
    actionQueue: actionQueueSorted,
    commerceLinkage: {
      avgHoursToPublish:
        avgHoursToPublish != null ? Math.round(avgHoursToPublish * 10) / 10 : null,
      timingSampleCount: timingSamples.length,
    },
  };
}

function inferCta(actionType: string | null): string {
  switch (actionType) {
    case 'defend':
      return 'improve_page';
    case 'long_bet':
      return 'generate_page';
    default:
      return 'generate_page';
  }
}
