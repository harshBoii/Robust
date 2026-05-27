import type { Prisma, PrismaClient } from '@/app/generated/prisma/client';

import { computeBountyEstimatedRevenue, effectiveBountyConversionRate } from '@/lib/geo/bountyRevenue';
import { medianCompanyAovFromProducts } from '@/lib/geo/shopifyAov';

export async function syncBountyRevenueForCompany(
  prisma: PrismaClient,
  companyId: string,
): Promise<void> {
  const [products, bounties] = await Promise.all([
    prisma.shopifyProduct.findMany({
      where: { companyId },
      select: { priceMinAmount: true, priceMaxAmount: true },
    }),
    prisma.citationBounty.findMany({
      where: { companyId },
      select: {
        id: true,
        estimatedReach: true,
        conversionRate: true,
        avgOrderValue: true,
      },
    }),
  ]);

  const catalogAov = medianCompanyAovFromProducts(products, 75);

  for (const b of bounties) {
    const conv = effectiveBountyConversionRate(b.conversionRate);
    const aov = b.avgOrderValue ?? catalogAov;
    const estimatedRevenue = computeBountyEstimatedRevenue({
      estimatedReach: b.estimatedReach,
      conversionRate: conv,
      avgOrderValue: aov,
    });

    const data: Prisma.CitationBountyUpdateInput = {};
    if (b.avgOrderValue == null && catalogAov != null) {
      data.avgOrderValue = catalogAov;
    }
    if (estimatedRevenue != null) {
      data.estimatedRevenue = estimatedRevenue;
    }

    if (Object.keys(data).length > 0) {
      await prisma.citationBounty.update({
        where: { id: b.id },
        data,
      });
    }
  }
}

