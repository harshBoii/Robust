import { prisma } from '@/lib/prisma';
import { buildRadarGetPayload } from '@/lib/geo/radar/buildRadarGetPayload';
import { loadGeoKnightTopicViews } from '@/lib/geo/geoknight/loadGeoKnightTopicViews';
import { aggregateCitationContextFromIntel } from '@/lib/geo/radar/aggregateCitationContext';
import { buildDailySparkSeries } from '@/lib/geo/report/spark-data';
import { pickHighlightPrompts } from '@/lib/geo/report/pick-highlight-prompts';
import type { CitationRow } from '@/app/components/organic/home/CitationsTable';

export function citationTypeLabel(query: string) {
  const q = query.toLowerCase();
  if (q.includes(' vs ') || q.includes('compare')) return 'Comparison';
  if (q.includes('alternative')) return 'Alternatives';
  if (q.includes('best') || q.includes('top')) return 'Recommendations';
  if (q.includes('tool') || q.includes('platform') || q.includes('software')) return 'Discovery';
  return 'Citation';
}

export async function loadOrganicHomeData(companyId: string) {
  const [payload, geoKnight, rivals, ownCompanyCitations] = await Promise.all([
    buildRadarGetPayload(prisma, companyId),
    loadGeoKnightTopicViews(companyId),
    prisma.companyRival.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { rivalCompany: { select: { id: true, name: true } } },
    }),
    prisma.citation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        execution: {
          include: {
            prompt: { select: { query: true } },
          },
        },
      },
    }),
  ]);

  const rivalsForCharts = rivals
    .map((r) => r.rivalCompany)
    .filter((c): c is { id: string; name: string } => Boolean(c));

  const sparkSeries = buildDailySparkSeries(payload.sovSeries);
  const contextRows = aggregateCitationContextFromIntel(payload.citationIntelligence);
  const highlightPrompts = pickHighlightPrompts(geoKnight.topicViews);

  const executionIds = Array.from(new Set(ownCompanyCitations.map((c) => c.executionId)));
  const executionCitations = executionIds.length
    ? await prisma.citation.findMany({
        where: { executionId: { in: executionIds } },
        select: { executionId: true, mentionedName: true, rank: true },
      })
    : [];

  const siblingsByExecution = new Map<string, Array<{ name: string; rank: number | null }>>();
  for (const cit of executionCitations) {
    const list = siblingsByExecution.get(cit.executionId) ?? [];
    list.push({ name: cit.mentionedName, rank: cit.rank });
    siblingsByExecution.set(cit.executionId, list);
  }

  const recentCitations: CitationRow[] = ownCompanyCitations.map((c) => {
    const siblings = (siblingsByExecution.get(c.executionId) ?? []).sort(
      (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
    );
    return {
      id: c.id,
      prompt: c.execution.prompt.query,
      model: c.execution.model,
      rank: c.rank,
      type: citationTypeLabel(c.execution.prompt.query),
      companies: siblings,
    };
  });

  return {
    payload,
    geoKnight,
    rivalsForCharts,
    sparkSeries,
    contextRows,
    highlightPrompts,
    recentCitations,
  };
}
