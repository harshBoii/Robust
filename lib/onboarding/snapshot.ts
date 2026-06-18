import 'server-only';

import { prisma } from '@/lib/prisma';

import type { OnboardingCompanySnapshot, StartupPlan } from './types';

export async function getOnboardingSnapshot(
  companyId: string,
): Promise<OnboardingCompanySnapshot | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      domain: true,
      website: true,
      onboardingStep: true,
      accessStatus: true,
      accessRequestedAt: true,
      onboardingPlan: true,
      brandEntity: {
        select: {
          id: true,
          canonicalName: true,
          industry: true,
          oneLiner: true,
          category: true,
          businessModel: true,
          targetAudiences: true,
        },
      },
      metaIntegration: { select: { id: true } },
      shopifyShops: {
        where: { status: 'installed' },
        select: { id: true },
        take: 1,
      },
      _count: { select: { shopifyProducts: true } },
    },
  });

  if (!company) return null;

  const plan = company.onboardingPlan as StartupPlan | null;

  return {
    id: company.id,
    name: company.name,
    domain: company.domain,
    website: company.website,
    onboardingStep: company.onboardingStep,
    accessStatus: company.accessStatus,
    accessRequestedAt: company.accessRequestedAt?.toISOString() ?? null,
    onboardingPlan: plan,
    brand: company.brandEntity
      ? {
          id: company.brandEntity.id,
          canonicalName: company.brandEntity.canonicalName,
          industry: company.brandEntity.industry,
          oneLiner: company.brandEntity.oneLiner,
          category: company.brandEntity.category,
          businessModel: company.brandEntity.businessModel,
          targetAudiences: company.brandEntity.targetAudiences,
        }
      : null,
    integrations: {
      metaConnected: Boolean(company.metaIntegration),
      shopifyConnected: company.shopifyShops.length > 0,
      shopifyProductCount: company._count.shopifyProducts,
    },
  };
}
