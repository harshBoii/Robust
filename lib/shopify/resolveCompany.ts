import { IntegrationProvider } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export async function resolveCompanyIdForShopifyLoad(
  rawShopDomain: string,
): Promise<string | null> {
  const shop = normalizeShopDomain(rawShopDomain);
  if (!shop) return null;

  const cms = await prisma.companyIntegrationCms.findFirst({
    where: {
      provider: IntegrationProvider.Shopify,
      expectedShopDomain: shop,
    },
    select: { companyId: true },
  });

  return cms?.companyId ?? null;
}
