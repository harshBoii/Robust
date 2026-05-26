import 'server-only';

import { prisma } from '@/lib/prisma';

import type { VideoGenCompanyContext } from './types';

function brandingField(branding: unknown, key: string): string | null {
  if (!branding || typeof branding !== 'object') return null;
  const v = (branding as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function loadCompanyContext(companyId: string): Promise<VideoGenCompanyContext> {
  const brandEntity = await prisma.brandEntity.findUnique({
    where: { companyId },
    include: {
      offerings: {
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      },
    },
  });

  const offerings = (brandEntity?.offerings ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    offeringType: o.offeringType,
    keywords: o.keywords,
    useCases: o.useCases,
    targetAudiences: o.targetAudiences,
    differentiators: o.differentiators,
    isPrimary: o.isPrimary,
  }));

  const primary = offerings.find((o) => o.isPrimary) ?? offerings[0] ?? null;

  const brand = {
    name: brandEntity?.canonicalName ?? 'Your brand',
    oneLiner: brandEntity?.oneLiner ?? null,
    about: brandEntity?.about ?? null,
    industry: brandEntity?.industry ?? null,
    category: brandEntity?.category ?? null,
    topics: brandEntity?.topics ?? [],
    keywords: brandEntity?.keywords ?? [],
    targetAudiences: brandEntity?.targetAudiences ?? [],
    toneOfVoice:
      brandingField(brandEntity?.branding, 'toneOfVoice') ??
      brandingField(brandEntity?.branding, 'tone'),
    brandValues: brandingField(brandEntity?.branding, 'values')
      ? [brandingField(brandEntity?.branding, 'values')!]
      : [],
    positioningStatement:
      brandingField(brandEntity?.branding, 'positioning') ??
      brandEntity?.oneLiner ??
      null,
    visualIdentityNotes:
      brandingField(brandEntity?.branding, 'visualIdentity') ??
      brandingField(brandEntity?.branding, 'visualNotes'),
  };

  const selectedOffering = primary
    ? {
        id: primary.id,
        name: primary.name,
        description: primary.description,
        category: brandEntity?.category ?? null,
        targetAudience: primary.targetAudiences,
        keyBenefits: primary.useCases,
        usp: primary.differentiators,
        pricingTier: brandingField(brandEntity?.branding, 'pricingTier'),
      }
    : null;

  return { brand, offerings, selectedOffering };
}

export function applyOfferingToContext(
  ctx: VideoGenCompanyContext,
  offeringId: string,
): VideoGenCompanyContext {
  const offering = ctx.offerings.find((o) => o.id === offeringId);
  if (!offering) return ctx;
  return {
    ...ctx,
    selectedOffering: {
      id: offering.id,
      name: offering.name,
      description: offering.description,
      category: ctx.brand.category,
      targetAudience: offering.targetAudiences,
      keyBenefits: offering.useCases,
      usp: offering.differentiators,
      pricingTier: null,
    },
  };
}
