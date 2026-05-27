import { prisma } from '@/lib/prisma';
import { resolvePromptRevenueUsd } from '@/lib/geo/promptRevenueResolve';
import type { RivalCompanyView, TopicView } from '@/lib/geo/geoknight/types';

type RivalConsensus = {
  companyName: string;
  avgRank: number | null;
  mentions: number;
};

type RivalByModel = {
  model: string;
  companyName: string;
  rank: number | null;
};

export type GeoKnightWorkspaceData = {
  companyName: string | null;
  topicViews: TopicView[];
  rivals: RivalCompanyView[];
};

export async function loadGeoKnightTopicViews(companyId: string): Promise<GeoKnightWorkspaceData> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const rivals = await prisma.companyRival.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    select: {
      rivalCompany: {
        select: { id: true, name: true, domain: true, website: true },
      },
    },
  });

  const topics = await prisma.llmTopic.findMany({
    where: { companyId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      prompts: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          query: true,
          reason: true,
          createdAt: true,
          ishunted: true,
          revenue: {
            select: {
              monthlyPromptReach: true,
              visibilityWeight: true,
              ctr: true,
              cvr: true,
              aov: true,
              estimatedRevenue: true,
            },
          },
        },
      },
    },
  });

  const promptIds = topics.flatMap((t) => t.prompts.map((p) => p.id));

  const [consensusRows, byModelRows] = promptIds.length
    ? await Promise.all([
        prisma.promptRivalConsensus.findMany({
          where: { promptId: { in: promptIds } },
          orderBy: [{ avgRank: 'asc' }, { mentions: 'desc' }],
          select: {
            promptId: true,
            companyName: true,
            avgRank: true,
            mentions: true,
          },
        }),
        prisma.promptRivalByModel.findMany({
          where: { promptId: { in: promptIds } },
          orderBy: [{ model: 'asc' }, { rank: 'asc' }],
          select: {
            promptId: true,
            model: true,
            companyName: true,
            rank: true,
          },
        }),
      ])
    : [[], []];

  const consensusByPrompt = new Map<string, RivalConsensus[]>();
  for (const row of consensusRows) {
    const list = consensusByPrompt.get(row.promptId) ?? [];
    list.push({
      companyName: row.companyName,
      avgRank: row.avgRank,
      mentions: row.mentions,
    });
    consensusByPrompt.set(row.promptId, list);
  }

  const byModelByPrompt = new Map<string, RivalByModel[]>();
  for (const row of byModelRows) {
    const list = byModelByPrompt.get(row.promptId) ?? [];
    list.push({
      model: row.model,
      companyName: row.companyName,
      rank: row.rank,
    });
    byModelByPrompt.set(row.promptId, list);
  }

  const topicViews: TopicView[] = topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    reason: topic.reason ?? topic.description ?? null,
    difficulty: topic.difficulty,
    createdAt: topic.createdAt.toISOString(),
    prompts: topic.prompts.map((prompt) => ({
      id: prompt.id,
      query: prompt.query,
      reason: prompt.reason ?? null,
      createdAt: prompt.createdAt.toISOString(),
      ishunted: prompt.ishunted,
      revenue: (() => {
        const rev = prompt.revenue;
        if (!rev) return null;
        const resolved = resolvePromptRevenueUsd(rev);
        if (resolved == null || !Number.isFinite(resolved)) return null;
        return {
          estimatedRevenue: resolved,
          monthlyPromptReach: rev.monthlyPromptReach ?? null,
          visibilityWeight: rev.visibilityWeight ?? null,
          ctr: rev.ctr ?? null,
          cvr: rev.cvr ?? null,
          aov: rev.aov ?? null,
        };
      })(),
      consensus: consensusByPrompt.get(prompt.id) ?? [],
      byModel: byModelByPrompt.get(prompt.id) ?? [],
    })),
  }));

  const rivalCompanies = rivals
    .map((r) => r.rivalCompany)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return {
    companyName: company?.name ?? null,
    topicViews,
    rivals: rivalCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain ?? null,
      website: c.website ?? null,
    })),
  };
}

export async function loadGeoKnightTopicViewsForCompanies(
  companyIds: string[],
  displayName: string | null,
): Promise<GeoKnightWorkspaceData> {
  if (companyIds.length === 0) {
    return { companyName: displayName, topicViews: [], rivals: [] };
  }
  if (companyIds.length === 1) {
    const one = await loadGeoKnightTopicViews(companyIds[0]!);
    return {
      ...one,
      companyName: displayName ?? one.companyName,
    };
  }
  const parts = await Promise.all(companyIds.map((id) => loadGeoKnightTopicViews(id)));
  const rivalMap = new Map<string, RivalCompanyView>();
  for (const part of parts) {
    for (const r of part.rivals) {
      rivalMap.set(r.id, r);
    }
  }
  return {
    companyName: displayName,
    topicViews: parts.flatMap((p) => p.topicViews),
    rivals: [...rivalMap.values()],
  };
}
