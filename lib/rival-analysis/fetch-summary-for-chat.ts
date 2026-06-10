import 'server-only';

import { prisma } from '@/lib/prisma';

export type RivalWithSummary = {
  id: string;
  brandName: string;
  markdown: string;
};

export type FetchRivalSummaryResult = {
  ok: boolean;
  brief: string | null;
  rivalsUsed: { id: string; brandName: string }[];
  error?: string;
};

const DEFAULT_MIX_LIMIT = 3;

/** Rivals that have at least one DONE scrape run with an intelligence summary. */
export async function listRivalsWithCompletedSummaries(
  companyId: string,
): Promise<RivalWithSummary[]> {
  const rivals = await prisma.companyRival.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    include: {
      scrapeRuns: {
        where: { status: 'DONE', summary: { isNot: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { summary: { select: { markdown: true } } },
      },
    },
  });

  const out: RivalWithSummary[] = [];
  for (const rival of rivals) {
    const run = rival.scrapeRuns[0];
    const markdown = run?.summary?.markdown?.trim();
    if (!markdown) continue;
    out.push({ id: rival.id, brandName: rival.brandName, markdown });
  }
  return out;
}

export async function fetchRivalIntelligenceSummary(
  companyId: string,
  opts?: { brandName?: string | null; mixLimit?: number },
): Promise<FetchRivalSummaryResult> {
  const mixLimit = opts?.mixLimit ?? DEFAULT_MIX_LIMIT;
  const available = await listRivalsWithCompletedSummaries(companyId);

  if (available.length === 0) {
    const rivalCount = await prisma.companyRival.count({ where: { companyId } });
    if (rivalCount === 0) {
      return {
        ok: false,
        brief: null,
        rivalsUsed: [],
        error:
          'No rival brands are set up yet. Add rivals on Rival Analysis and run an analysis first.',
      };
    }
    return {
      ok: false,
      brief: null,
      rivalsUsed: [],
      error:
        'Rival analysis summaries are not ready yet. Run analysis on Rival Analysis, then try again.',
    };
  }

  const brandQuery = opts?.brandName?.trim();
  let selected: RivalWithSummary[];

  if (brandQuery) {
    const match = available.find(
      (r) => r.brandName.toLowerCase() === brandQuery.toLowerCase(),
    );
    if (!match) {
      return {
        ok: false,
        brief: null,
        rivalsUsed: [],
        error: `No completed analysis found for rival "${brandQuery}". Pick another brand or use a mix of top rivals.`,
      };
    }
    selected = [match];
  } else {
    selected = available.slice(0, mixLimit);
  }

  const brief = selected
    .map((r) => `## Rival: ${r.brandName}\n${r.markdown}`)
    .join('\n\n---\n\n');

  return {
    ok: true,
    brief,
    rivalsUsed: selected.map((r) => ({ id: r.id, brandName: r.brandName })),
  };
}
