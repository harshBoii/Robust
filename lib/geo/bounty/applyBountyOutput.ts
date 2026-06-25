import type { Difficulty, PrismaClient } from '@/app/generated/prisma/client';

import { syncBountyRevenueForCompany } from '@/lib/geo/radar/bountySync';
import {
  persistPromptMetricsForCompany,
  resolveTopicIdForPromptQuery,
} from '@/lib/geo/radar/persistPromptMetrics';

export type BountyNichePrompt = {
  prompt: string;
  reason?: string;
  use?: string;
};

export type BountyNiche = {
  topic: string;
  description?: string;
  difficulty?: string;
  prompts?: BountyNichePrompt[];
  prompt_count?: number;
};

export type BountyCitation = {
  prompt: string;
  model: string;
  companies: Array<{ name: string; product?: string; rank: number }>;
};

export type BountyOutput = {
  niches: BountyNiche[];
  summary?: {
    total_niches?: number;
    total_prompts?: number;
    by_difficulty?: Record<string, number>;
  };
  topic_prompt_analysis?: TopicPromptAnalysisItem[];
  raw_responses_with_prompt?: Array<{
    prompt: string;
    model: string;
    response: unknown;
    error?: string | null;
  }>;
  revenue_by_prompt?: Record<string, PromptRevenuePayload>;
  citations: BountyCitation[];
};

type TopicPromptAnalysisItem = {
  topic: string;
  link?: string;
  reason?: string;
  use?: string;
  prompts?: TopicPromptAnalysisPromptItem[];
};

type TopicPromptAnalysisPromptItem = {
  prompt: string;
  link?: string;
  reason?: string;
  use?: string;
  estimated_revenue?: number | PromptRevenuePayload | null;
  cited_companies_by_model?: Array<{
    model: string;
    companies: Array<{ name: string; product?: string; rank?: number | null }>;
  }>;
  cited_companies_consensus?: Array<{
    name: string;
    avg_rank?: number | null;
    mentions?: number | null;
  }>;
};

type PromptRevenuePayload = {
  monthlyPromptReach?: number | null;
  visibilityWeight?: number | null;
  ctr?: number | null;
  cvr?: number | null;
  aov?: number | null;
  estimatedRevenue?: number | null;
};

type BountyServiceResponse =
  | BountyOutput
  | {
      result?: BountyOutput;
    };

function isBountyEnvelope(value: BountyServiceResponse): value is { result?: BountyOutput } {
  return typeof value === 'object' && value !== null && 'result' in value;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function coerceToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.content === 'string') return v.content;
    if (typeof v.raw_content === 'string') return v.raw_content;
    if (typeof v.answer === 'string') return v.answer;
    if (typeof v.response === 'string') return v.response;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mapDifficulty(value: string | undefined | null): Difficulty {
  const k = (value ?? '').trim().toLowerCase();
  if (k === 'easy') return 'EASY';
  if (k === 'hard') return 'HARD';
  return 'MEDIUM';
}

function extractEstimatedRevenue(value: unknown): number | null {
  if (typeof value === 'number') return toNullableNumber(value);
  if (value && typeof value === 'object') {
    const v = value as PromptRevenuePayload;
    return toNullableNumber(v.estimatedRevenue);
  }
  return null;
}

function extractRevenuePayload(value: unknown): PromptRevenuePayload | null {
  if (value && typeof value === 'object') {
    const v = value as PromptRevenuePayload;
    return {
      monthlyPromptReach: toNullableNumber(v.monthlyPromptReach),
      visibilityWeight: toNullableNumber(v.visibilityWeight),
      ctr: toNullableNumber(v.ctr),
      cvr: toNullableNumber(v.cvr),
      aov: toNullableNumber(v.aov),
      estimatedRevenue: toNullableNumber(v.estimatedRevenue),
    };
  }
  return null;
}

export function parseBountyMicroservicePayload(value: unknown): BountyOutput | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as BountyServiceResponse;
  const bountyOutput: BountyOutput | null = isBountyEnvelope(v) ? v.result ?? null : v;
  if (!bountyOutput || !Array.isArray(bountyOutput.niches)) return null;
  if (!Array.isArray(bountyOutput.citations)) return null;
  return bountyOutput;
}

export async function applyBountyOutput(
  prisma: PrismaClient,
  company: { id: string; name: string },
  bountyOutput: BountyOutput,
): Promise<{ summary: NonNullable<BountyOutput['summary']> }> {
  const companyId = company.id;

  const topicPromptAnalysis = Array.isArray(bountyOutput.topic_prompt_analysis)
    ? bountyOutput.topic_prompt_analysis
    : [];
  const revenueByPrompt =
    bountyOutput.revenue_by_prompt && typeof bountyOutput.revenue_by_prompt === 'object'
      ? bountyOutput.revenue_by_prompt
      : {};
  const rawResponses = Array.isArray(bountyOutput.raw_responses_with_prompt)
    ? bountyOutput.raw_responses_with_prompt
    : [];

  const topicReasonByName = new Map<string, string | null>();
  for (const item of topicPromptAnalysis) {
    const name = item.topic?.trim();
    if (!name) continue;
    topicReasonByName.set(name, item.reason?.trim() || null);
  }

  const nicheMetaByName = new Map<
    string,
    { description: string | null; difficulty: Difficulty }
  >();
  for (const niche of bountyOutput.niches) {
    const name = niche.topic?.trim();
    if (!name) continue;
    const analysisReason = topicReasonByName.get(name);
    nicheMetaByName.set(name, {
      description: niche.description?.trim() || analysisReason || null,
      difficulty: mapDifficulty(niche.difficulty),
    });
  }

  const topicIdMap = new Map<string, string>();
  for (const [name, meta] of nicheMetaByName.entries()) {
    const reason = meta.description;
    const topic = await prisma.llmTopic.upsert({
      where: { companyId_name: { companyId, name } },
      create: {
        companyId,
        name,
        description: reason,
        reason,
        difficulty: meta.difficulty,
      },
      update: {
        reason,
        difficulty: meta.difficulty,
        ...(reason ? { description: reason } : {}),
      },
      select: { id: true },
    });
    topicIdMap.set(name, topic.id);
  }

  const nichePromptMeta = new Map<string, { topicName: string; reason: string | null }>();
  for (const niche of bountyOutput.niches) {
    const topicName = niche.topic?.trim();
    if (!topicName) continue;
    for (const p of niche.prompts ?? []) {
      const q = p.prompt?.trim();
      if (!q || nichePromptMeta.has(q)) continue;
      nichePromptMeta.set(q, {
        topicName,
        reason: p.reason?.trim() || null,
      });
    }
  }

  const analysisPromptMeta = new Map<
    string,
    {
      topicName: string;
      reason: string | null;
      estimatedRevenue: number | null;
      revenuePayload: PromptRevenuePayload | null;
      byModel: NonNullable<TopicPromptAnalysisPromptItem['cited_companies_by_model']>;
      consensus: NonNullable<TopicPromptAnalysisPromptItem['cited_companies_consensus']>;
    }
  >();
  for (const item of topicPromptAnalysis) {
    const topicName = item.topic?.trim();
    if (!topicName) continue;
    for (const p of item.prompts ?? []) {
      const q = p.prompt?.trim();
      if (!q) continue;
      const revenuePayload = extractRevenuePayload(p.estimated_revenue);
      analysisPromptMeta.set(q, {
        topicName,
        reason: p.reason?.trim() || nichePromptMeta.get(q)?.reason || null,
        estimatedRevenue:
          extractEstimatedRevenue(p.estimated_revenue) ??
          toNullableNumber(revenuePayload?.estimatedRevenue),
        revenuePayload,
        byModel: p.cited_companies_by_model ?? [],
        consensus: p.cited_companies_consensus ?? [],
      });
    }
  }

  const topicNames = [...nicheMetaByName.keys()];
  const uniquePrompts = [
    ...new Set([
      ...bountyOutput.citations.map((c) => c.prompt),
      ...[...nichePromptMeta.keys()],
      ...rawResponses.map((r) => r.prompt),
      ...Object.keys(revenueByPrompt),
      ...[...analysisPromptMeta.keys()],
    ]),
  ];

  const existingPrompts = uniquePrompts.length
    ? await prisma.prompt.findMany({
        where: { query: { in: uniquePrompts } },
        select: { id: true, query: true, topicId: true },
      })
    : [];

  const promptMap = new Map<string, { id: string; topicId: string | null }>();
  for (const p of existingPrompts) {
    if (!promptMap.has(p.query)) {
      promptMap.set(p.query, { id: p.id, topicId: p.topicId });
    }
  }

  for (const promptQuery of uniquePrompts) {
    const analysisMeta = analysisPromptMeta.get(promptQuery);
    const nicheMeta = nichePromptMeta.get(promptQuery);
    const topicName = analysisMeta?.topicName ?? nicheMeta?.topicName;
    const topicIdFromNiche = topicName != null ? topicIdMap.get(topicName) ?? null : null;
    const topicId =
      topicIdFromNiche ??
      resolveTopicIdForPromptQuery(promptQuery, topicNames, topicIdMap) ??
      null;
    const reason = analysisMeta?.reason ?? nicheMeta?.reason ?? null;

    const existing = promptMap.get(promptQuery);
    if (existing) {
      await prisma.prompt.update({
        where: { id: existing.id },
        data: {
          topicId: topicId ?? existing.topicId,
          topic: topicName ?? topicNames[0] ?? promptQuery,
          reason: reason ?? undefined,
        },
      });
      promptMap.set(promptQuery, { id: existing.id, topicId: topicId ?? existing.topicId });
      continue;
    }

    const created = await prisma.prompt.create({
      data: {
        query: promptQuery,
        topic: topicName ?? topicNames[0] ?? promptQuery,
        topicId,
        reason,
        isActive: true,
      },
    });
    promptMap.set(promptQuery, { id: created.id, topicId });
  }

  const promptRevenueRows = Object.entries(revenueByPrompt)
    .map(([query, payload]) => {
      const normalizedQuery = query?.trim();
      if (!normalizedQuery) return null;
      const promptId = promptMap.get(normalizedQuery)?.id;
      if (!promptId) return null;
      const analysisMeta = analysisPromptMeta.get(normalizedQuery);
      const fallbackPayload = analysisMeta?.revenuePayload;
      return {
        promptId,
        monthlyPromptReach:
          toNullableNumber(payload?.monthlyPromptReach) ??
          toNullableNumber(fallbackPayload?.monthlyPromptReach),
        visibilityWeight:
          toNullableNumber(payload?.visibilityWeight) ??
          toNullableNumber(fallbackPayload?.visibilityWeight),
        ctr: toNullableNumber(payload?.ctr) ?? toNullableNumber(fallbackPayload?.ctr),
        cvr: toNullableNumber(payload?.cvr) ?? toNullableNumber(fallbackPayload?.cvr),
        aov: toNullableNumber(payload?.aov) ?? toNullableNumber(fallbackPayload?.aov),
        estimatedRevenue:
          toNullableNumber(payload?.estimatedRevenue) ??
          toNullableNumber(analysisMeta?.estimatedRevenue) ??
          toNullableNumber(fallbackPayload?.estimatedRevenue),
      };
    })
    .filter(
      (
        row,
      ): row is {
        promptId: string;
        monthlyPromptReach: number | null;
        visibilityWeight: number | null;
        ctr: number | null;
        cvr: number | null;
        aov: number | null;
        estimatedRevenue: number | null;
      } => Boolean(row),
    );

  for (const row of promptRevenueRows) {
    await prisma.promptRevenue.upsert({
      where: { promptId: row.promptId },
      create: row,
      update: row,
    });
  }

  const execMap = new Map<string, string>();
  const rawResponseByPair = new Map<string, { response: string; error: string | null | undefined }>();
  for (const item of rawResponses) {
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
    const model = typeof item.model === 'string' ? item.model.trim() : '';
    if (!prompt || !model) continue;
    const key = `${prompt}|||${model}`;
    rawResponseByPair.set(key, {
      response: coerceToText(item.response),
      error: item.error == null ? undefined : coerceToText(item.error),
    });
  }

  const uniqueExecPairs = [
    ...new Set([
      ...bountyOutput.citations.map((c) => `${c.prompt}|||${c.model}`),
      ...[...rawResponseByPair.keys()],
    ]),
  ];

  for (const pair of uniqueExecPairs) {
    const [promptQuery, model] = pair.split('|||');
    const promptId = promptMap.get(promptQuery)?.id;
    if (!promptId) continue;
    const rawEntry = rawResponseByPair.get(pair);
    const rawResponse = rawEntry?.response.trim() ?? '';
    const rawError = rawEntry?.error?.trim() ?? '';
    const executionResponse = rawResponse || (rawError ? `[error] ${rawError}` : '');
    const exec = await prisma.promptExecution.create({
      data: {
        promptId,
        model,
        response: executionResponse,
      },
    });
    execMap.set(`${promptId}:${model}`, exec.id);
  }

  const citationRows: Array<{
    executionId: string;
    companyId: string | null;
    mentionedName: string;
    rank: number | null;
  }> = [];

  for (const cit of bountyOutput.citations) {
    const promptId = promptMap.get(cit.prompt)?.id;
    if (!promptId) continue;
    const execId = execMap.get(`${promptId}:${cit.model}`);
    if (!execId) continue;

    for (const comp of cit.companies) {
      const ourCompany = comp.name.toLowerCase() === company.name.toLowerCase();
      citationRows.push({
        executionId: execId,
        companyId: ourCompany ? companyId : null,
        mentionedName: comp.name,
        rank: comp.rank ?? null,
      });
    }
  }

  if (citationRows.length) {
    await prisma.citation.createMany({
      data: citationRows,
    });
  }

  const promptIdsWithAnalysis = [...analysisPromptMeta.keys()]
    .map((q) => promptMap.get(q)?.id)
    .filter((id): id is string => Boolean(id));

  if (promptIdsWithAnalysis.length > 0) {
    await prisma.promptRivalByModel.deleteMany({
      where: { promptId: { in: promptIdsWithAnalysis } },
    });
    await prisma.promptRivalConsensus.deleteMany({
      where: { promptId: { in: promptIdsWithAnalysis } },
    });

    const byModelRows: Array<{ promptId: string; model: string; companyName: string; rank: number | null }> =
      [];
    const consensusRows: Array<{
      promptId: string;
      companyName: string;
      avgRank: number | null;
      mentions: number;
    }> = [];

    for (const [query, meta] of analysisPromptMeta.entries()) {
      const promptId = promptMap.get(query)?.id;
      if (!promptId) continue;
      for (const modelEntry of meta.byModel) {
        for (const comp of modelEntry.companies ?? []) {
          const name = comp.name?.trim();
          if (!name) continue;
          byModelRows.push({
            promptId,
            model: modelEntry.model,
            companyName: name,
            rank: comp.rank ?? null,
          });
        }
      }
      for (const comp of meta.consensus) {
        const name = comp.name?.trim();
        if (!name) continue;
        consensusRows.push({
          promptId,
          companyName: name,
          avgRank: comp.avg_rank ?? null,
          mentions: Math.max(0, comp.mentions ?? 0),
        });
      }
    }

    if (byModelRows.length) {
      const byModelUnique = new Map<
        string,
        { promptId: string; model: string; companyName: string; rank: number | null }
      >();
      for (const row of byModelRows) {
        const key = `${row.promptId}|||${row.model}|||${row.companyName.toLowerCase()}`;
        const prev = byModelUnique.get(key);
        if (!prev || (row.rank ?? 999) < (prev.rank ?? 999)) {
          byModelUnique.set(key, row);
        }
      }
      await prisma.promptRivalByModel.createMany({
        data: [...byModelUnique.values()],
        skipDuplicates: true,
      });
    }

    if (consensusRows.length) {
      const consensusUnique = new Map<
        string,
        { promptId: string; companyName: string; avgRank: number | null; mentions: number }
      >();
      for (const row of consensusRows) {
        const key = `${row.promptId}|||${row.companyName.toLowerCase()}`;
        const prev = consensusUnique.get(key);
        if (!prev) {
          consensusUnique.set(key, row);
          continue;
        }
        const mergedMentions = Math.max(prev.mentions, row.mentions);
        const mergedAvgRank =
          prev.avgRank == null
            ? row.avgRank
            : row.avgRank == null
              ? prev.avgRank
              : Math.min(prev.avgRank, row.avgRank);
        consensusUnique.set(key, {
          ...prev,
          mentions: mergedMentions,
          avgRank: mergedAvgRank,
        });
      }
      await prisma.promptRivalConsensus.createMany({
        data: [...consensusUnique.values()],
        skipDuplicates: true,
      });
    }
  }

  await syncBountyRevenueForCompany(prisma, companyId);
  await persistPromptMetricsForCompany(prisma, companyId);

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const niche of bountyOutput.niches) {
    const k = mapDifficulty(niche.difficulty).toLowerCase();
    if (k in byDifficulty) (byDifficulty as Record<string, number>)[k]++;
  }

  const totalPrompts =
    bountyOutput.summary?.total_prompts ??
    uniquePrompts.length;

  return {
    summary: {
      total_niches: bountyOutput.summary?.total_niches ?? bountyOutput.niches.length,
      total_prompts: totalPrompts,
      by_difficulty: bountyOutput.summary?.by_difficulty ?? byDifficulty,
    },
  };
}
