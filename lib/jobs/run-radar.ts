import 'server-only';

import { Agent, fetch as undiciFetch } from 'undici';

import { prisma } from '@/lib/prisma';
import { applyRadarOutput, parseRadarMicroservicePayload } from '@/lib/geo/radar/applyRadarOutput';
import { requireLimit } from '@/lib/subscription/check-limit';
import { incrementUsage } from '@/lib/subscription/increment-usage';

const radarDispatcher = new Agent({
  headersTimeout: 420_000,
  bodyTimeout: 600_000,
});

type RadarPostInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
};

async function fetchRadarWithRetry(url: string, init: RadarPostInit, retries = 2) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await undiciFetch(url, {
        ...init,
        dispatcher: radarDispatcher,
      });
    } catch (err) {
      lastErr = err;
      const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
      const isHeaderTimeout = code === 'UND_ERR_HEADERS_TIMEOUT';
      const isFetchFailed = String((err as Error)?.message ?? '').includes('fetch failed');
      if (attempt >= retries || (!isHeaderTimeout && !isFetchFailed)) throw err;
      await new Promise((r) => setTimeout(r, 750 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

export async function runRadarJob(companyId: string) {
  const [company, brandEntity, geoDataSources, llmTopics, shopifyProducts, rivals] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, website: true, description: true, linkedinUrl: true },
    }),
    prisma.brandEntity.findUnique({
      where: { companyId },
      include: { offerings: true },
    }),
    prisma.geoDataSource.findMany({
      where: {
        companyId,
        sourceType: 'URL',
        label: { in: ['LinkedIn', 'Website URL'] },
        isActive: true,
      },
      select: { label: true, rawContent: true },
    }),
    prisma.llmTopic.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { prompts: { where: { isActive: true }, select: { query: true } } },
    }),
    prisma.shopifyProduct.findMany({
      where: { companyId },
      orderBy: { shopifyUpdatedAt: 'desc' },
      select: { title: true, onlineStoreUrl: true },
    }),
    prisma.companyRival.findMany({
      where: { companyId, rivalCompanyId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { rivalCompany: { select: { name: true } } },
    }),
  ]);

  if (!company) throw new Error(`Company not found: ${companyId}`);

  const website =
    company.website?.trim() ??
    geoDataSources.find((s) => s.label === 'Website URL')?.rawContent?.trim() ??
    '';
  const linkedin =
    company.linkedinUrl?.trim() ??
    geoDataSources.find((s) => s.label === 'LinkedIn')?.rawContent?.trim() ??
    '';

  const primaryOffering = brandEntity?.offerings.find((o) => o.isPrimary) ?? brandEntity?.offerings[0];
  const competitorsFromRivals = rivals.map((r) => r.rivalCompany?.name).filter(Boolean);
  const competitorsFromOffer = primaryOffering?.competitors ?? [];
  const competitors = (() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const name of [...competitorsFromRivals, ...competitorsFromOffer]) {
      const n = (name ?? '').trim();
      if (!n || seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      out.push(n);
    }
    return out;
  })();

  const brandOfferings =
    brandEntity?.offerings.map((o) => ({
      product: o.name ?? undefined,
      productType: o.offeringType ?? undefined,
      url: o.url ?? undefined,
      differentiators: o.differentiators ?? [],
      useCases: o.useCases ?? [],
      targetAudiences: o.targetAudiences ?? [],
      competitorGroups: o.competitors ?? [],
    })) ?? [];

  const shopifyOfferings = shopifyProducts
    .filter((p) => Boolean(p.title?.trim()))
    .map((p) => ({
      product: p.title.trim(),
      productType: 'PRODUCT',
      url: p.onlineStoreUrl ?? undefined,
      differentiators: [] as string[],
      useCases: [] as string[],
      targetAudiences: [] as string[],
      competitorGroups: [] as string[],
    }));

  const input = {
    company: {
      name: company.name,
      website: website || 'https://example.com',
      linkedin: linkedin || 'https://linkedin.com',
      about: brandEntity?.about ?? company.description ?? undefined,
    },
    brandEntity: {
      category: brandEntity?.category ?? '',
      topics: brandEntity?.topics ?? [],
      keywords: brandEntity?.keywords ?? [],
      ...([...brandOfferings, ...shopifyOfferings].length > 0
        ? { offerings: [...brandOfferings, ...shopifyOfferings] }
        : {}),
    },
    competitors,
    models: ['gpt-5.4-nano', 'claude-haiku-4-5-20251001', 'gemini-3.1-flash-lite-preview'],
    ...(llmTopics.length > 0 ? { llmTopics: llmTopics.map((t) => t.name) } : {}),
  };

  const base = process.env.MICROSERVICE_URL;
  if (!base) throw new Error('MICROSERVICE_URL is not configured');

  await requireLimit(companyId, 'radarScans');

  const res = await fetchRadarWithRetry(`${base.replace(/\/$/, '')}/company/radar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, session_id: `company-radar-${companyId}` }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Radar microservice failed (${res.status}): ${text}`);
  }

  const radarOutput = parseRadarMicroservicePayload(await res.json());
  if (!radarOutput) throw new Error('Invalid radar response');

  await incrementUsage(companyId, 'radarScans');

  const { normalizedMetrics } = await applyRadarOutput(prisma, company, radarOutput);
  return {
    input,
    topics: radarOutput.topics ?? [],
    prompts: radarOutput.prompts ?? [],
    citations: radarOutput.citations ?? [],
    metrics: normalizedMetrics,
  };
}
