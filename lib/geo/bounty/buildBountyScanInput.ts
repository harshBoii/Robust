import 'server-only';

import { prisma } from '@/lib/prisma';
import { buildStandOutProducts } from '@/lib/geo/bounty/buildBountyPayload';

export type BountyScanInput = {
  company: {
    name: string;
    website: string;
    linkedin: string;
    about?: string;
  };
  brandEntity: {
    category: string;
    topics: string[];
    keywords: string[];
    offerings?: Array<{
      product: string;
      productType?: string;
      url?: string;
      differentiators: string[];
      useCases: string[];
      targetAudiences: string[];
      competitorGroups: string[];
    }>;
  };
  competitors: string[];
  standOutProducts: Array<{ name: string; shortDescription: string }>;
  models: string[];
  session_id: string;
};

export async function buildBountyScanInput(companyId: string): Promise<BountyScanInput> {
  const [company, brandEntity, geoDataSources, shopifyProducts, rivals, standOutProducts] =
    await Promise.all([
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
      buildStandOutProducts(companyId),
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
      product: p.title!.trim(),
      productType: 'PRODUCT',
      url: p.onlineStoreUrl ?? undefined,
      differentiators: [] as string[],
      useCases: [] as string[],
      targetAudiences: [] as string[],
      competitorGroups: [] as string[],
    }));

  const allOfferings = [...brandOfferings, ...shopifyOfferings].filter(
    (o): o is typeof o & { product: string } => Boolean(o.product?.trim()),
  );

  return {
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
      ...(allOfferings.length > 0 ? { offerings: allOfferings } : {}),
    },
    competitors,
    standOutProducts,
    models: [],
    session_id: `company-bounty-${companyId}`,
  };
}
