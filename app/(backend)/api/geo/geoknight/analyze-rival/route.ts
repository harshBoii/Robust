import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { callCompanySeedMicroservice } from '@/lib/data-mine/microservice-client';
import { persistSeedResponse } from '@/lib/data-mine/persist-seed';
import { applyRadarOutput, parseRadarMicroservicePayload } from '@/lib/geo/radar/applyRadarOutput';

type Mode = 'rival' | 'ours';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rivalCompanyId = String(body?.rivalCompanyId ?? '').trim();
  const mode = (String(body?.mode ?? '').trim() || 'rival') as Mode;

  if (!rivalCompanyId || (mode !== 'rival' && mode !== 'ours')) {
    return NextResponse.json(
      { success: false, error: 'rivalCompanyId and mode are required' },
      { status: 400 },
    );
  }

  const requesterCompanyId = session.companyId;

  const allowed = await prisma.companyRival.findFirst({
    where: { companyId: requesterCompanyId, rivalCompanyId },
    select: { id: true },
  });

  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const base = process.env.MICROSERVICE_URL;
  if (!base) {
    return NextResponse.json(
      { success: false, error: 'MICROSERVICE_URL is not configured' },
      { status: 500 },
    );
  }

  const rivalCompany = await prisma.company.findUnique({
    where: { id: rivalCompanyId },
    select: { id: true, name: true, website: true, domain: true, description: true },
  });
  if (!rivalCompany) {
    return NextResponse.json({ success: false, error: 'Rival company not found' }, { status: 404 });
  }

  const websiteUrl =
    rivalCompany.website?.trim() ||
    (rivalCompany.domain ? `https://${rivalCompany.domain}` : '');
  if (!websiteUrl) {
    return NextResponse.json(
      { success: false, error: 'Rival company website/domain is missing. Add a domain first.' },
      { status: 400 },
    );
  }

  // STEP 1: seed
  try {
    const seedResponse = await callCompanySeedMicroservice({
      websiteUrl,
      sessionId: `geoknight-rival-${rivalCompanyId}`,
    });
    await persistSeedResponse(rivalCompanyId, seedResponse);
  } catch (err) {
    console.error('Seed failed:', err);
    return NextResponse.json(
      { success: false, error: 'Seed failed', details: (err as Error).message },
      { status: 502 },
    );
  }

  // Fetch updated rival identity + brand inputs after seed
  const [rivalAfterSeed, rivalBrandEntity, rivalOfferings, ourBrandEntity, ourOfferings, rivalRivals] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: rivalCompanyId },
        select: { id: true, name: true, website: true, description: true },
      }),
      prisma.brandEntity.findUnique({ where: { companyId: rivalCompanyId } }),
      prisma.brandEntity
        .findUnique({ where: { companyId: rivalCompanyId }, select: { id: true } })
        .then((e) =>
          e
            ? prisma.offering.findMany({
                where: { brandEntityId: e.id },
                orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
                take: 50,
              })
            : [],
        ),
      mode === 'ours' ? prisma.brandEntity.findUnique({ where: { companyId: requesterCompanyId } }) : null,
      mode === 'ours'
        ? prisma.brandEntity
            .findUnique({ where: { companyId: requesterCompanyId }, select: { id: true } })
            .then((e) =>
              e
                ? prisma.offering.findMany({
                    where: { brandEntityId: e.id },
                    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
                    take: 50,
                  })
                : [],
            )
        : [],
      prisma.companyRival.findMany({
        where: { companyId: rivalCompanyId, rivalCompanyId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { rivalCompany: { select: { name: true } } },
      }),
    ]);

  const rivalName = rivalAfterSeed?.name ?? rivalCompany.name;
  const rivalWebsite = rivalAfterSeed?.website ?? websiteUrl;

  const competitors: string[] = [];
  const seen = new Set<string>();
  for (const row of rivalRivals) {
    const n = (row.rivalCompany?.name ?? '').trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    competitors.push(n);
  }

  const brandEntity =
    mode === 'ours'
      ? {
          category: ourBrandEntity?.category ?? '',
          topics: ourBrandEntity?.topics ?? [],
          keywords: ourBrandEntity?.keywords ?? [],
          offerings: (ourOfferings ?? []).map((o) => ({
            product: o.name ?? undefined,
            productType: o.offeringType ?? undefined,
            url: o.url ?? undefined,
            differentiators: o.differentiators ?? [],
            useCases: o.useCases ?? [],
            targetAudiences: o.targetAudiences ?? [],
            competitorGroups: o.competitors ?? [],
          })),
        }
      : {
          category: rivalBrandEntity?.category ?? '',
          topics: rivalBrandEntity?.topics ?? [],
          keywords: rivalBrandEntity?.keywords ?? [],
          offerings: (rivalOfferings ?? []).map((o) => ({
            product: o.name ?? undefined,
            productType: o.offeringType ?? undefined,
            url: o.url ?? undefined,
            differentiators: o.differentiators ?? [],
            useCases: o.useCases ?? [],
            targetAudiences: o.targetAudiences ?? [],
            competitorGroups: o.competitors ?? [],
          })),
        };

  const input = {
    company: {
      name: rivalName,
      website: rivalWebsite || 'https://example.com',
      linkedin: 'https://linkedin.com',
      about: rivalBrandEntity?.about ?? rivalAfterSeed?.description ?? rivalCompany.description ?? undefined,
    },
    brandEntity: {
      category: brandEntity.category,
      topics: brandEntity.topics,
      keywords: brandEntity.keywords,
      ...(brandEntity.offerings && brandEntity.offerings.length > 0
        ? { offerings: brandEntity.offerings }
        : {}),
    },
    competitors,
    models: ['gpt-5.4-nano', 'claude-haiku-4-5-20251001', 'gemini-3.1-flash-lite-preview'],
  };

  // STEP 2: radar
  const radarUrl = `${base.replace(/\/$/, '')}/company/radar`;
  let payload: unknown;
  try {
    const res = await fetch(radarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        session_id: `geoknight-rival-${rivalCompanyId}-${mode}`,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: 'Radar microservice failed', status: res.status, body: text || undefined },
        { status: 502 },
      );
    }
    payload = await res.json();
  } catch (err) {
    console.error('Radar microservice error:', err);
    return NextResponse.json(
      { success: false, error: 'Error contacting radar service' },
      { status: 502 },
    );
  }

  const radarOutput = parseRadarMicroservicePayload(payload);
  if (!radarOutput) {
    return NextResponse.json({ success: false, error: 'Invalid radar response' }, { status: 502 });
  }

  const { normalizedMetrics } = await applyRadarOutput(
    prisma,
    { id: rivalCompanyId, name: rivalName },
    radarOutput,
  );

  return NextResponse.json({
    success: true,
    rivalCompanyId,
    mode,
    normalizedMetrics,
  });
}
