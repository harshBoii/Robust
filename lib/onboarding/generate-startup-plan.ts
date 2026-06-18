import 'server-only';

import { z } from 'zod';

import {
  completeJsonChat,
  completeJsonResponsesWithWebSearch,
  parseLlmJson,
} from '@/lib/assistant/openai-json';
import { CHAT_AGENT_MODEL } from '@/lib/assistant/models';
import { prisma } from '@/lib/prisma';

import type { StartupPlan } from './types';

const PLAN_MODEL = process.env.ONBOARDING_PLAN_MODEL?.trim() || 'gpt-4.1';

const planSchema = z.object({
  recommendedApproach: z.enum(['aeo_first', 'ads_first', 'balanced']),
  headline: z.string(),
  rationale: z.array(z.string()),
  evidence: z.array(
    z.object({
      claim: z.string(),
      source: z.string().optional(),
    }),
  ),
  firstWeekActions: z.array(z.string()),
  metricsToWatch: z.array(z.string()),
});

const SYSTEM = `You are a growth strategist for D2C and SaaS brands using Robust (ads automation + AEO/GEO).
Use web search to find relevant industry anecdotes, benchmarks, or case patterns when helpful.
Recommend whether the brand should prioritize AEO (answer-engine / citation growth), paid Meta ads, or a balanced approach.

Return JSON only with keys:
- recommendedApproach: "aeo_first" | "ads_first" | "balanced"
- headline: one compelling sentence for the user
- rationale: 3-5 bullet strings explaining why
- evidence: array of { claim, source? } with anecdotal or cited support
- firstWeekActions: 4-6 concrete first-week steps in Robust
- metricsToWatch: 3-5 KPIs to track`;

function buildContext(company: NonNullable<Awaited<ReturnType<typeof loadCompanyContext>>>) {
  return {
    company: {
      name: company.name,
      domain: company.domain,
      website: company.website,
    },
    brandEntity: company.brandEntity,
    metaAdsProfile: company.metaIntegration
      ? {
          connected: true,
          hasAdAccount: Boolean(company.metaIntegration.adAccountId),
          brandVoice: company.metaIntegration.brandVoice,
          topAdExamples: company.metaIntegration.topAdExamples,
          audienceInsights: company.metaIntegration.audienceInsights,
          avgWinningCtr: company.metaIntegration.avgWinningCtr,
        }
      : { connected: false },
    shopify: {
      connected: company.shopifyShops.length > 0,
      shopDomain: company.shopifyShops[0]?.shopDomain ?? null,
      productCount: company._count.shopifyProducts,
    },
  };
}

async function loadCompanyContext(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      domain: true,
      website: true,
      onboardingPlan: true,
      brandEntity: {
        include: {
          communicationDna: true,
          audienceDna: true,
          visualDna: true,
          offerings: { where: { isActive: true }, take: 3 },
        },
      },
      metaIntegration: {
        select: {
          brandVoice: true,
          topAdExamples: true,
          audienceInsights: true,
          avgWinningCtr: true,
          adAccountId: true,
        },
      },
      shopifyShops: {
        where: { status: 'installed' },
        select: { shopDomain: true },
        take: 1,
      },
      _count: { select: { shopifyProducts: true } },
    },
  });
}

function parsePlan(raw: string): StartupPlan {
  return planSchema.parse(parseLlmJson(raw));
}

async function generateWithWebSearch(context: unknown): Promise<string> {
  return completeJsonResponsesWithWebSearch({
    model: PLAN_MODEL,
    system: SYSTEM,
    user: `Create a personalized getting-started plan for this brand:\n${JSON.stringify(context, null, 2)}`,
  });
}

async function generateWithoutWebSearch(context: unknown): Promise<string> {
  return completeJsonChat({
    model: CHAT_AGENT_MODEL,
    system: SYSTEM,
    user: `Create a personalized getting-started plan for this brand (no live web search — use general industry knowledge):\n${JSON.stringify(context, null, 2)}`,
  });
}

export async function generateStartupPlan(companyId: string): Promise<StartupPlan> {
  const company = await loadCompanyContext(companyId);
  if (!company) throw new Error('Company not found');

  const cached = company.onboardingPlan;
  if (cached && typeof cached === 'object') {
    const parsed = planSchema.safeParse(cached);
    if (parsed.success) return parsed.data;
  }

  const context = buildContext(company);

  try {
    const raw = await generateWithWebSearch(context);
    return parsePlan(raw);
  } catch (webSearchError) {
    console.warn('[onboarding/plan] web search failed, falling back to chat', webSearchError);
    try {
      const raw = await generateWithoutWebSearch(context);
      return parsePlan(raw);
    } catch (fallbackError) {
      const webMsg =
        webSearchError instanceof Error ? webSearchError.message : 'web search failed';
      const fallbackMsg =
        fallbackError instanceof Error ? fallbackError.message : 'fallback failed';
      throw new Error(`Plan generation failed: ${webMsg}; fallback: ${fallbackMsg}`);
    }
  }
}
