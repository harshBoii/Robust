import type { BountyDifficulty, Citation, Difficulty, PrismaClient, PromptExecution } from '@/app/generated/prisma/client';

import { REACH_CAP } from '@/lib/geo/constants';
import { medianCompanyAovFromProducts } from '@/lib/geo/shopifyAov';
import {
  businessFitScore,
  classifyAction,
  opportunityScore,
  promptEstimatedRevenue,
} from '@/lib/geo/scoring';

function bountyToTopicDifficulty(d: BountyDifficulty): Difficulty {
  if (d === 'EASY') return 'EASY';
  if (d === 'HARD') return 'HARD';
  return 'MEDIUM';
}

function pickTopicDifficulty(
  topic: Difficulty | null | undefined,
  bounty: BountyDifficulty | null | undefined,
): Difficulty | null {
  if (topic) return topic;
  if (bounty) return bountyToTopicDifficulty(bounty);
  return null;
}

type ExecWithCites = PromptExecution & { citations: Citation[] };

export async function persistPromptMetricsForCompany(
  prisma: PrismaClient,
  companyId: string,
): Promise<void> {
  const [assumption, products, brandEntity, promptIdsFromCites, topicPrompts] =
    await Promise.all([
      prisma.radarAssumption.findUnique({ where: { companyId } }),
      prisma.shopifyProduct.findMany({
        where: { companyId },
        select: { priceMinAmount: true, priceMaxAmount: true },
      }),
      prisma.brandEntity.findUnique({
        where: { companyId },
        include: {
          offerings: { where: { isActive: true }, take: 20 },
        },
      }),
      prisma.citation.findMany({
        where: { companyId },
        select: { execution: { select: { promptId: true } } },
      }),
      prisma.prompt.findMany({
        where: { llmTopic: { companyId } },
        select: { id: true },
      }),
    ]);

  const ctr = assumption?.ctr ?? 0.02;
  const cvr = assumption?.cvr ?? 0.025;
  const aovMultiplier = assumption?.aovMultiplier ?? 1;
  const aovProxy = medianCompanyAovFromProducts(products, 75);

  const idSet = new Set<string>();
  for (const c of promptIdsFromCites) idSet.add(c.execution.promptId);
  for (const p of topicPrompts) idSet.add(p.id);
  const promptIds = [...idSet];
  if (promptIds.length === 0) return;

  const offeringNames = (brandEntity?.offerings ?? []).map((o) => o.name);
  const offeringKeywords = (brandEntity?.offerings ?? []).flatMap((o) => o.keywords);
  const brandKeywords = brandEntity?.keywords ?? [];

  const bountyByQuery = new Map<
    string,
    { reach: number | null; confidence: number; difficulty: BountyDifficulty }
  >();
  const bounties = await prisma.citationBounty.findMany({
    where: { companyId },
    select: { query: true, estimatedReach: true, confidence: true, difficulty: true },
  });
  for (const b of bounties) {
    const k = b.query.trim().toLowerCase();
    if (!bountyByQuery.has(k)) {
      bountyByQuery.set(k, {
        reach: b.estimatedReach,
        confidence: b.confidence,
        difficulty: b.difficulty,
      });
    }
  }

  const prompts = await prisma.prompt.findMany({
    where: { id: { in: promptIds } },
    include: {
      llmTopic: { select: { id: true, difficulty: true } },
    },
  });

  const allExecs = (await prisma.promptExecution.findMany({
    where: { promptId: { in: promptIds } },
    include: { citations: true },
    orderBy: { executedAt: 'desc' },
  })) as ExecWithCites[];

  const execsByPrompt = new Map<string, ExecWithCites[]>();
  for (const e of allExecs) {
    const list = execsByPrompt.get(e.promptId) ?? [];
    list.push(e);
    execsByPrompt.set(e.promptId, list);
  }

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);

  for (const prompt of prompts) {
    const execs = execsByPrompt.get(prompt.id) ?? [];
    const bKey = prompt.query.trim().toLowerCase();
    const bounty = bountyByQuery.get(bKey);
    const topicDifficulty = prompt.llmTopic?.difficulty ?? null;
    const diff = pickTopicDifficulty(topicDifficulty, bounty?.difficulty);
    const fit = businessFitScore(prompt.query, offeringNames, offeringKeywords, brandKeywords);

    const models = [...new Set(execs.map((e) => e.model))];
    const totalDistinctModels = models.length;

    const modelsCitingPrompt = new Set(
      execs
        .filter((e) => e.citations.some((c) => c.companyId === companyId))
        .map((e) => e.model),
    );

    for (const model of models) {
      const modelExecs = execs.filter((e) => e.model === model);
      const latest = modelExecs[0];
      const oursLatest = latest?.citations.filter((c) => c.companyId === companyId) ?? [];
      const isMentioned = oursLatest.length > 0;
      const latestRank =
        oursLatest
          .map((c) => c.rank)
          .filter((r): r is number => r != null && r > 0)
          .sort((a, b) => a - b)[0] ?? null;

      const modelGapFlag =
        totalDistinctModels > 1 && modelsCitingPrompt.size < totalDistinctModels;

      const recent7 = modelExecs.filter(
        (e) => e.executedAt >= d7 && e.citations.some((c) => c.companyId === companyId),
      );
      const recent30 = modelExecs.filter(
        (e) => e.executedAt >= d30 && e.citations.some((c) => c.companyId === companyId),
      );
      const avgRank = (rows: ExecWithCites[]) => {
        const ranks = rows.flatMap((r) =>
          r.citations
            .filter((c) => c.companyId === companyId)
            .map((c) => c.rank)
            .filter((x): x is number => x != null && x > 0),
        );
        if (!ranks.length) return null;
        return ranks.reduce((a, b) => a + b, 0) / ranks.length;
      };
      const a7 = avgRank(recent7);
      const a30 = avgRank(recent30);
      const rankTrend7d = a7 != null && a30 != null ? a30 - a7 : null;
      const rankTrend30d = a30;

      const estimatedReach = bounty?.reach ?? null;
      const confidence = bounty?.confidence ?? null;
      const actionType = classifyAction({
        latestRank,
        isMentioned,
        estimatedReach,
        difficulty: diff,
        modelGapFlag,
      });
      const opp = opportunityScore({
        latestRank,
        isMentioned,
        estimatedReach,
        confidence,
        difficulty: diff,
        businessFit: fit,
        reachCap: REACH_CAP,
      });
      const estRev = promptEstimatedRevenue({
        estimatedReach,
        ctr,
        cvr,
        aovProxy,
        aovMultiplier,
      });

      await prisma.llmPromptMetric.upsert({
        where: {
          companyId_promptId_model: {
            companyId,
            promptId: prompt.id,
            model,
          },
        },
        create: {
          companyId,
          promptId: prompt.id,
          topicId: prompt.llmTopic?.id ?? null,
          model,
          latestRank,
          isMentioned,
          estimatedReach,
          confidence,
          difficulty: diff,
          businessFit: fit,
          opportunityScore: opp,
          estimatedRevenue: estRev,
          actionType,
          rankTrend7d,
          rankTrend30d,
          modelGapFlag,
        },
        update: {
          topicId: prompt.llmTopic?.id ?? null,
          latestRank,
          isMentioned,
          estimatedReach,
          confidence,
          difficulty: diff,
          businessFit: fit,
          opportunityScore: opp,
          estimatedRevenue: estRev,
          actionType,
          rankTrend7d,
          rankTrend30d,
          modelGapFlag,
          calculatedAt: new Date(),
        },
      });
    }
  }
}

export function resolveTopicIdForPromptQuery(
  promptQuery: string,
  topicNames: string[],
  topicIdMap: Map<string, string>,
): string | null {
  const q = promptQuery.toLowerCase();
  for (const name of topicNames) {
    const n = name.toLowerCase();
    if (q.includes(n) || n.includes(q)) {
      const idz = topicIdMap.get(name);
      if (idz) return idz;
    }
  }
  if (topicNames.length === 1) {
    return topicIdMap.get(topicNames[0]!) ?? null;
  }
  return null;
}

