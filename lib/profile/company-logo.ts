import 'server-only';

import { prisma } from '@/lib/prisma';

export async function getCompanyLogoUrl(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { logoUrl: true },
  });
  return company?.logoUrl ?? null;
}
