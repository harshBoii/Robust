import 'server-only';

import { prisma } from '@/lib/prisma';

export async function requireBrandForSession(brandId: string, companyId: string) {
  const brand = await prisma.brandEntity.findFirst({
    where: { id: brandId, companyId },
    include: {
      company: { select: { website: true } },
      offerings: {
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        take: 5,
      },
    },
  });
  return brand;
}

export async function getBrandEntityIdForCompany(companyId: string): Promise<string | null> {
  const row = await prisma.brandEntity.findUnique({
    where: { companyId },
    select: { id: true },
  });
  return row?.id ?? null;
}
