import 'server-only';

import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getPublishAdapter } from '@/lib/geo/bounty/publish';

const SOCIAL_PLATFORMS: BountySpreadPlatform[] = ['X', 'LINKEDIN', 'REDDIT', 'THIRD_PARTY_BLOG'];

export type PublishTargetsData = {
  shopify: { available: boolean };
  wordpressWoo: { available: boolean; reason?: string };
  websiteBlog: { available: boolean; reason?: string };
  social: Record<string, { available: boolean; reason?: string }>;
  connectedAccounts: Array<{ provider: string; accountHandle: string | null }>;
};

export async function getPublishTargetsForBounty(
  companyId: string,
  bountyId: string,
): Promise<PublishTargetsData | null> {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId },
    select: { id: true },
  });

  if (!bounty) return null;

  const shopify = await prisma.shopifyShop.findFirst({
    where: { companyId, status: 'installed' },
    select: { id: true },
  });

  const websiteBlogAvailability = await getPublishAdapter('WEBSITE_BLOG').isAvailable(companyId);

  const social: Record<string, { available: boolean; reason?: string }> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    social[platform] = await getPublishAdapter(platform).isAvailable(companyId);
  }

  const integrations = await prisma.socialIntegration.findMany({
    where: { companyId },
    select: { provider: true, accountHandle: true },
  });

  return {
    shopify: { available: Boolean(shopify) },
    wordpressWoo: { available: false, reason: 'WordPress integration not yet configured' },
    websiteBlog: websiteBlogAvailability,
    social,
    connectedAccounts: integrations.map((i) => ({
      provider: i.provider,
      accountHandle: i.accountHandle,
    })),
  };
}
