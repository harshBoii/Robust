import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { BountyView } from "@/app/components/geo/bounty";
import {
  maxPromptRevenueByQuery,
  mergeBountyEstimatesByNormalizedQuery,
  normalizePromptQuery,
  resolveBountyRevenueUsd,
  resolvePromptRevenueUsd,
} from "@/lib/geo/promptRevenueResolve";

export default async function BountyPage() {
  const session = await getSession();
  const companyId = session?.companyId ?? null;

  if (!companyId) {
    return (
      <div className="w-full min-h-[60vh] px-6 pb-6 pt-2">
        <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass)] p-6 text-sm text-muted-foreground">
          Sign in as a company user to view Bounty.
        </div>
      </div>
    );
  }

  const [topics, bounties] = await Promise.all([
    prisma.llmTopic.findMany({
      where: { companyId: companyId ?? undefined },
      orderBy: { createdAt: "desc" },
      include: {
        prompts: {
          where: { isActive: true },
          select: { id: true, query: true },
        },
      },
    }),
    prisma.citationBounty.findMany({
      where: { companyId },
      select: { query: true, status: true, estimatedRevenue: true },
    }),
  ]);

  const topicPromptIds = [...new Set(topics.flatMap((t) => t.prompts.map((p) => p.id)))];

  const citedExecutions =
    topicPromptIds.length > 0
      ? await prisma.citation.findMany({
          where: {
            companyId,
            execution: { promptId: { in: topicPromptIds } },
          },
          select: { execution: { select: { promptId: true } } },
        })
      : [];
  const citedPromptIds = new Set(
    citedExecutions
      .map((c) => c.execution?.promptId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const prompts_cited = topicPromptIds.filter((id) => citedPromptIds.has(id)).length;
  const prompts_uncited = topicPromptIds.length - prompts_cited;
  const promptsWithRevenue = await prisma.prompt.findMany({
    where: {
      isActive: true,
      OR: [
        ...(topicPromptIds.length > 0 ? [{ id: { in: topicPromptIds } }] : []),
        { llmTopic: { companyId } },
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
    promptsWithRevenue.map((p) => ({ query: p.query, revenue: p.revenue }))
  );

  const bountyEstByNorm = mergeBountyEstimatesByNormalizedQuery(bounties);

  const promptRowById = new Map(
    promptsWithRevenue.map((p) => [p.id, p])
  );

  function resolvedUsdForPromptQuery(query: string): number {
    const k = normalizePromptQuery(query);
    return resolveBountyRevenueUsd({
      query,
      bountyEstimatedRevenue: bountyEstByNorm.get(k) ?? null,
      promptRevenueByQuery,
    });
  }

  let total_estimated_revenue_uncited_prompts = 0;
  for (const id of topicPromptIds) {
    if (citedPromptIds.has(id)) continue;
    const row = promptRowById.get(id);
    if (!row) continue;
    total_estimated_revenue_uncited_prompts += resolvedUsdForPromptQuery(row.query);
  }

  const promptRevenueValues = promptsWithRevenue.map((p) => resolvePromptRevenueUsd(p.revenue) ?? 0);
  const estimatedRevenueFromPromptAvg =
    promptRevenueValues.length > 0
      ? promptRevenueValues.reduce((a, b) => a + b, 0) / promptRevenueValues.length
      : 0;

  const niches = topics.map((t) => {
    const seenNorm = new Set<string>();
    let topicEstimatedRevenue = 0;
    for (const p of t.prompts) {
      const k = normalizePromptQuery(p.query);
      if (seenNorm.has(k)) continue;
      seenNorm.add(k);
      topicEstimatedRevenue += resolvedUsdForPromptQuery(p.query);
    }

    const prompts = t.prompts.map((p) => {
      const row = promptRowById.get(p.id);
      const r = row?.revenue;
      const revenueBreakdown =
        r != null
          ? {
              monthlyPromptReach: r.monthlyPromptReach ?? null,
              visibilityWeight: r.visibilityWeight ?? null,
              ctr: r.ctr ?? null,
              cvr: r.cvr ?? null,
              aov: r.aov ?? null,
            }
          : null;
      return {
        id: p.id,
        query: p.query,
        resolvedRevenue: resolvedUsdForPromptQuery(p.query),
        revenueBreakdown,
      };
    });

    return {
      id: t.id,
      topic: t.name,
      description: t.description ?? "",
      difficulty: t.difficulty,
      createdAt: t.createdAt.toISOString(),
      topicEstimatedRevenue,
      prompts,
      prompt_count: t.prompts.length,
    };
  });

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const n of niches) {
    const k = n.difficulty.toLowerCase();
    if (k in byDifficulty) (byDifficulty as Record<string, number>)[k]++;
  }

  const summary = {
    total_niches: niches.length,
    total_prompts: niches.reduce((s, n) => s + n.prompt_count, 0),
    by_difficulty: byDifficulty,
    prompts_cited,
    prompts_uncited,
    estimated_revenue_from_bounty: estimatedRevenueFromPromptAvg,
    total_estimated_revenue_for_bounty_left: total_estimated_revenue_uncited_prompts,
  };

  return (
    <div className="max-w-5xl mx-auto min-h-[60vh] px-6 pb-6 pt-2">
      <BountyView initialNiches={niches} summary={summary} />
    </div>
  );
}
