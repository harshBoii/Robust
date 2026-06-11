import 'server-only';

import type { BrandEntity, Company, Offering } from '@/app/generated/prisma/client';

function brandingField(branding: unknown, key: string): string | null {
  if (!branding || typeof branding !== 'object') return null;
  const v = (branding as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export type BrandProfileForDna = {
  brand_name: string;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  target_audience: string[];
  brand_values: string[];
  brand_mission: string | null;
  brand_vision: string | null;
  unique_selling_point: string[];
  competitors: string[];
  product_category: string | null;
  price_positioning: string | null;
  website: string | null;
};

export function buildBrandProfile(input: {
  brandEntity: BrandEntity;
  company: Pick<Company, 'website'>;
  primaryOffering?: Offering | null;
}): BrandProfileForDna {
  const { brandEntity, company, primaryOffering } = input;
  const branding = brandEntity.branding;

  const valuesFromBranding = brandingField(branding, 'values');
  const brandValues = valuesFromBranding
    ? [valuesFromBranding]
    : brandEntity.topics.length
      ? brandEntity.topics
      : [];

  return {
    brand_name: brandEntity.canonicalName,
    tagline: brandEntity.oneLiner,
    description: brandEntity.about,
    industry: brandEntity.industry,
    target_audience: brandEntity.targetAudiences,
    brand_values: brandValues,
    brand_mission: brandingField(branding, 'mission'),
    brand_vision: brandingField(branding, 'vision'),
    unique_selling_point: primaryOffering?.differentiators ?? [],
    competitors: primaryOffering?.competitors ?? [],
    product_category: brandEntity.category,
    price_positioning: brandingField(branding, 'pricingTier'),
    website: company.website,
  };
}
