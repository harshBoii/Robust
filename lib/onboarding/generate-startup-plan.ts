import 'server-only';

import { z } from 'zod';

import { completeJsonResponsesWithWebSearch, parseLlmJson } from '@/lib/assistant/openai-json';
import { prisma } from '@/lib/prisma';

import type { StartupPlan } from './types';

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

export async function generateStartupPlan(companyId: string): Promise<StartupPlan> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      domain: true,
      website: true,
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

  if (!company) throw new Error('Company not found');

  const context = {
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

  const raw = await completeJsonResponsesWithWebSearch({
    model: 'gpt-4.1',
    system: SYSTEM,
    user: `Create a personalized getting-started plan for this brand:\n${JSON.stringify(context, null, 2)}`,
    reasoning: { effort: 'high' },
  });

  const parsed = planSchema.parse(parseLlmJson(raw));
  return parsed;
}
