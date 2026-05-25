import type { OfferingType } from '@/app/generated/prisma/client';

import type {
  MappedBrandEntityFromSeed,
  MappedCompanyFromSeed,
  MappedOfferingFromSeed,
  MappedSeedPayload,
  MicroserviceSeedResponse,
} from '@/lib/data-mine/types';

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
}

function optionalString(v: unknown, maxLen: number): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeOfferingType(raw: unknown): OfferingType {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (s === 'SERVICE') return 'SERVICE';
  if (s === 'OTHER') return 'OTHER';
  return 'PRODUCT';
}

export function mapCompanyFromSeed(company: MicroserviceSeedResponse['company']): MappedCompanyFromSeed {
  if (!company) return {};
  const out: MappedCompanyFromSeed = {};
  const name = optionalString(company.name, 255);
  const slug = optionalString(company.slug, 255);
  if (name) out.name = name;
  if (slug) out.slug = slug;
  if (company.description !== undefined) out.description = optionalString(company.description, 5000);
  if (company.logoUrl !== undefined) out.logoUrl = optionalString(company.logoUrl, 1000);
  if (company.website !== undefined) out.website = optionalString(company.website, 500);
  if (company.email !== undefined) out.email = optionalString(company.email, 255);
  return out;
}

export function mapBrandEntityFromSeed(
  brandEntity: MicroserviceSeedResponse['brandEntity'],
  branding: MicroserviceSeedResponse['branding'],
): MappedBrandEntityFromSeed | null {
  if (!brandEntity) return null;
  const canonicalName = optionalString(brandEntity.canonicalName, 255);
  if (!canonicalName) return null;

  return {
    canonicalName,
    aliases: stringArray(brandEntity.aliases),
    entityType: optionalString(brandEntity.entityType, 64),
    oneLiner: optionalString(brandEntity.oneLiner, 10000),
    about: optionalString(brandEntity.about, 50000),
    industry: optionalString(brandEntity.industry, 255),
    category: optionalString(brandEntity.category, 255),
    headquartersCity: optionalString(brandEntity.headquartersCity, 255),
    headquartersCountry: optionalString(brandEntity.headquartersCountry, 255),
    foundedYear:
      typeof brandEntity.foundedYear === 'number' && Number.isFinite(brandEntity.foundedYear)
        ? Math.trunc(brandEntity.foundedYear)
        : null,
    employeeRange: optionalString(brandEntity.employeeRange, 64),
    businessModel: optionalString(brandEntity.businessModel, 64),
    topics: stringArray(brandEntity.topics),
    keywords: stringArray(brandEntity.keywords),
    targetAudiences: stringArray(brandEntity.targetAudiences),
    branding: branding ?? null,
  };
}

export function mapOfferingsFromSeed(
  offerings: MicroserviceSeedResponse['offerings'],
): MappedOfferingFromSeed[] {
  if (!Array.isArray(offerings)) return [];

  const mapped: MappedOfferingFromSeed[] = [];
  for (const o of offerings) {
    const name = optionalString(o.name, 500);
    const slug = optionalString(o.slug, 255);
    if (!name || !slug) continue;
    mapped.push({
      name,
      slug,
      description: optionalString(o.description, 50000),
      offeringType: normalizeOfferingType(o.offeringType),
      url: optionalString(o.url, 1000),
      keywords: stringArray(o.keywords),
      useCases: stringArray(o.useCases),
      targetAudiences: stringArray(o.targetAudiences),
      differentiators: stringArray(o.differentiators),
      competitors: stringArray(o.competitors),
      isPrimary: Boolean(o.isPrimary),
      isActive: o.isActive !== false,
    });
  }
  return mapped;
}

export function mapSeedResponse(response: MicroserviceSeedResponse): MappedSeedPayload {
  return {
    company: mapCompanyFromSeed(response.company),
    brandEntity: mapBrandEntityFromSeed(response.brandEntity, response.branding),
    offerings: mapOfferingsFromSeed(response.offerings),
  };
}
