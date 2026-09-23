import 'server-only';

import { Prisma } from '@/app/generated/prisma/client';

import { mapSeedResponse } from '@/lib/data-mine/map-seed-response';
import { getDataMineSnapshot } from '@/lib/data-mine/get-data-mine';
import type { DataMineSnapshot, MicroserviceSeedResponse } from '@/lib/data-mine/types';
import { prisma } from '@/lib/prisma';

export async function persistSeedResponse(
  companyId: string,
  response: MicroserviceSeedResponse,
): Promise<DataMineSnapshot> {
  const mapped = mapSeedResponse(response);

  await prisma.$transaction(async (tx) => {
    // Auto-fill enriches the brand, not the account. Never overwrite what identifies the
    // account (website the user entered, slug, login email), and only fill descriptive
    // fields the user hasn't set yet.
    const current = await tx.company.findUnique({
      where: { id: companyId },
      select: { name: true, description: true, logoUrl: true },
    });
    const companyData: Prisma.CompanyUpdateInput = {};
    if (mapped.company.name && !current?.name?.trim()) companyData.name = mapped.company.name;
    if (mapped.company.description && !current?.description?.trim()) {
      companyData.description = mapped.company.description;
    }
    if (mapped.company.logoUrl && !current?.logoUrl?.trim()) companyData.logoUrl = mapped.company.logoUrl;

    if (Object.keys(companyData).length > 0) {
      await tx.company.update({ where: { id: companyId }, data: companyData });
    }

    if (!mapped.brandEntity) return;

    const brand = await tx.brandEntity.upsert({
      where: { companyId },
      create: {
        companyId,
        ...mapped.brandEntity,
        branding:
          mapped.brandEntity.branding === null
            ? Prisma.JsonNull
            : (mapped.brandEntity.branding as Prisma.InputJsonValue),
      },
      update: {
        ...mapped.brandEntity,
        branding:
          mapped.brandEntity.branding === null
            ? Prisma.JsonNull
            : (mapped.brandEntity.branding as Prisma.InputJsonValue),
      },
    });

    await tx.offering.deleteMany({ where: { brandEntityId: brand.id } });

    if (mapped.offerings.length > 0) {
      await tx.offering.createMany({
        data: mapped.offerings.map((o) => ({
          companyId,
          brandEntityId: brand.id,
          name: o.name,
          slug: o.slug,
          description: o.description,
          offeringType: o.offeringType,
          url: o.url,
          keywords: o.keywords,
          useCases: o.useCases,
          targetAudiences: o.targetAudiences,
          differentiators: o.differentiators,
          competitors: o.competitors,
          isPrimary: o.isPrimary,
          isActive: o.isActive,
        })),
      });
    }
  });

  const snapshot = await getDataMineSnapshot(companyId);
  if (!snapshot) throw new Error('Company not found after seed');
  return snapshot;
}
