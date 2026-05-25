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
    const companyData: Prisma.CompanyUpdateInput = {};
    if (mapped.company.name) companyData.name = mapped.company.name;
    if (mapped.company.slug) companyData.slug = mapped.company.slug;
    if (mapped.company.description !== undefined) companyData.description = mapped.company.description;
    if (mapped.company.logoUrl !== undefined) companyData.logoUrl = mapped.company.logoUrl;
    if (mapped.company.website !== undefined) companyData.website = mapped.company.website;
    if (mapped.company.email !== undefined) companyData.email = mapped.company.email;

    if (Object.keys(companyData).length > 0) {
      try {
        await tx.company.update({ where: { id: companyId }, data: companyData });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const { slug: _slug, ...rest } = companyData;
          if (Object.keys(rest).length > 0) {
            await tx.company.update({ where: { id: companyId }, data: rest });
          }
        } else {
          throw e;
        }
      }
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
