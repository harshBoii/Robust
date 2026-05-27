import type { PrismaClient } from '@/app/generated/prisma/client';

import { syncBountyRevenueForCompany } from '@/lib/geo/radar/bountySync';
import {
  persistPromptMetricsForCompany,
  resolveTopicIdForPromptQuery,
} from '@/lib/geo/radar/persistPromptMetrics';

export type RadarOutput = {
  topics: string[];
  prompts: string[];
  raw_responses_with_prompt?: Array<{
    prompt: string;
    model: string;
    response: string;
    error?: string | null;
  }>;
  citations: Array<{
    prompt: string;
    model: string;
    companies: Array<{ name: string; rank: number }>;
  }>;
  metrics: {
    share_of_voice: number;
    top3_rate: number;
    query_coverage: number;
    competitor_rank: number;
    topic_authority: number;
  };
  topic_prompt_analysis?: TopicPromptAnalysisItem[];
  revenue_by_prompt?: Record<string, PromptRevenuePayload>;
};

export type RadarMetrics = RadarOutput['metrics'];

type TopicPromptAnalysisItem = {
  topic: string;
  link?: string;
  reason?: string;
  prompts?: TopicPromptAnalysisPromptItem[];
};

type TopicPromptAnalysisPromptItem = {
  prompt: string;
  link?: string;
  reason?: string;
  estimated_revenue?: number | null;
  cited_companies_by_model?: Array<{
    model: string;
    companies: Array<{ name: string; rank?: number | null }>;
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

type RadarServiceResponse =
  | RadarOutput
  | {
      input?: unknown;
      output?: RadarOutput;
    };

function isRadarEnvelope(value: RadarServiceResponse): value is { input?: unknown; output?: RadarOutput } {
  return typeof value === 'object' && value !== null && 'output' in value;
}

function normalizePercentMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return value <= 1 ? value * 100 : value;
}

function normalizeRadarMetrics(metrics: RadarMetrics): RadarMetrics {
  return {
    share_of_voice: normalizePercentMetric(metrics.share_of_voice) ?? 0,
    top3_rate: normalizePercentMetric(metrics.top3_rate) ?? 0,
    query_coverage: normalizePercentMetric(metrics.query_coverage) ?? 0,
    competitor_rank: metrics.competitor_rank,
    topic_authority: metrics.topic_authority,
  };
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

export function parseRadarMicroservicePayload(value: unknown): RadarOutput | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as RadarServiceResponse;
  const radarOutput: RadarOutput | null = isRadarEnvelope(v) ? v.output ?? null : v;
  if (!radarOutput?.metrics || typeof radarOutput.metrics !== 'object') return null;
  if (!Array.isArray(radarOutput.citations)) return null;
  return radarOutput;
}

export async function applyRadarOutput(
  prisma: PrismaClient,
  company: { id: string; name: string },
  radarOutput: RadarOutput,
): Promise<{ normalizedMetrics: RadarMetrics }> {
  const companyId = company.id;

  const normalizedMetrics = normalizeRadarMetrics(radarOutput.metrics);
  const modelsUsed = [...new Set(radarOutput.citations.map((c) => c.model))];

  const metricModels = modelsUsed.length ? modelsUsed : ['aggregate'];
  await prisma.llmRadarMetric.createMany({
    data: metricModels.map((model) => ({
      companyId,
      model,
      shareOfVoice: normalizedMetrics.share_of_voice,
      top3Rate: normalizedMetrics.top3_rate,
      queryCoverage: normalizedMetrics.query_coverage,
      competitorRank: normalizedMetrics.competitor_rank,
      topicAuthority: normalizedMetrics.topic_authority,
      avgRank: normalizedMetrics.competitor_rank,
    })),
  });

  const topicPromptAnalysis = Array.isArray(radarOutput.topic_prompt_analysis)
    ? radarOutput.topic_prompt_analysis
    : [];
  const revenueByPrompt =
    radarOutput.revenue_by_prompt && typeof radarOutput.revenue_by_prompt === 'object'
      ? radarOutput.revenue_by_prompt
      : {};
  const rawResponses = Array.isArray(radarOutput.raw_responses_with_prompt)
    ? radarOutput.raw_responses_with_prompt
    : [];
  const topicReasonByName = new Map<string, string | null>();
  for (const item of topicPromptAnalysis) {
    const name = item.topic?.trim();
    if (!name) continue;
    topicReasonByName.set(name, item.reason?.trim() || null);
  }
  const topicNames = [
    ...new Set(
      [
        ...(radarOutput.topics ?? []),
        ...topicPromptAnalysis.map((t) => t.topic),
      ].filter((t): t is string => Boolean(t?.trim())),
    ),
  ];
  const topicIdMap = new Map<string, string>();
  for (const name of topicNames) {
    const reason = topicReasonByName.get(name) ?? null;
    const topic = await prisma.llmTopic.upsert({
      where: { companyId_name: { companyId, name } },
      create: {
        companyId,
        name,
        description: reason,
        reason,
      },
      update: {
        reason,
        ...(reason ? { description: reason } : {}),
      },
      select: { id: true },
    });
    topicIdMap.set(name, topic.id);
  }

  const analysisPromptMeta = new Map<
    string,
    {
      topicName: string;
      reason: string | null;
      estimatedRevenue: number | null;
      byModel: NonNullable<TopicPromptAnalysisPromptItem['cited_companies_by_model']>;
      consensus: NonNullable<TopicPromptAnalysisPromptItem['cited_companies_consensus']>;
    }
  >();
  for (const item of topicPromptAnalysis) {
    const topicName = item.topic?.trim();
    if (!topicName) continue;
    for (const p of item.prompts ?? []) {
      const q = p.prompt?.trim();
      if (!q || analysisPromptMeta.has(q)) continue;
      analysisPromptMeta.set(q, {
        topicName,
        reason: p.reason?.trim() || null,
        estimatedRevenue: toNullableNumber(p.estimated_revenue),
        byModel: p.cited_companies_by_model ?? [],
        consensus: p.cited_companies_consensus ?? [],
      });
    }
  }

  const uniquePrompts = [
    ...new Set([
      ...radarOutput.citations.map((c) => c.prompt),
      ...(radarOutput.prompts ?? []),
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
    const meta = analysisPromptMeta.get(promptQuery);
    const topicIdFromAnalysis = meta?.topicName != null ? topicIdMap.get(meta.topicName) ?? null : null;
    const topicId =
      topicIdFromAnalysis ??
      resolveTopicIdForPromptQuery(promptQuery, topicNames, topicIdMap) ??
      null;
    const existing = promptMap.get(promptQuery);
    if (existing) {
      await prisma.prompt.update({
        where: { id: existing.id },
        data: {
          topicId: topicId ?? existing.topicId,
          topic: meta?.topicName ?? topicNames[0] ?? promptQuery,
          reason: meta?.reason ?? undefined,
        },
      });
      promptMap.set(promptQuery, { id: existing.id, topicId: topicId ?? existing.topicId });
      continue;
    }
    const created = await prisma.prompt.create({
      data: {
        query: promptQuery,
        topic: meta?.topicName ?? topicNames[0] ?? promptQuery,
        topicId,
        reason: meta?.reason ?? null,
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
      return {
        promptId,
        monthlyPromptReach: toNullableNumber(payload?.monthlyPromptReach),
        visibilityWeight: toNullableNumber(payload?.visibilityWeight),
        ctr: toNullableNumber(payload?.ctr),
        cvr: toNullableNumber(payload?.cvr),
        aov: toNullableNumber(payload?.aov),
        estimatedRevenue:
          toNullableNumber(payload?.estimatedRevenue) ??
          toNullableNumber(analysisPromptMeta.get(normalizedQuery)?.estimatedRevenue),
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
      ...radarOutput.citations.map((c) => `${c.prompt}|||${c.model}`),
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

  for (const cit of radarOutput.citations) {
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

    const byModelRows: Array<{ promptId: string; model: string; companyName: string; rank: number | null }> = [];
    const consensusRows: Array<{ promptId: string; companyName: string; avgRank: number | null; mentions: number }> = [];

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

  return { normalizedMetrics };
}
