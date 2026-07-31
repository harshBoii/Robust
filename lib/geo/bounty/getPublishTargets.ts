import 'server-only';

import type { BountySpreadPlatform, WordPressJsonLdMode } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getPublishAdapter } from '@/lib/geo/bounty/publish';
import { parseBlogDestination, type BlogDestination } from '@/lib/geo/bounty/blog-destination';

const SOCIAL_PLATFORMS: BountySpreadPlatform[] = ['X', 'LINKEDIN', 'REDDIT', 'THIRD_PARTY_BLOG'];

export type WordPressTarget = {
  available: boolean;
  reason?: string;
  siteUrl?: string;
  /** How JSON-LD will be delivered, so the UI can warn before publishing. */
  jsonLdMode?: WordPressJsonLdMode;
  schemaWarning?: string;
};

export type PublishTargetsData = {
  shopify: { available: boolean };
  wordpress: WordPressTarget;
  /** @deprecated Legacy key kept for existing clients; mirrors `wordpress.available`. */
  wordpressWoo: { available: boolean; reason?: string };
  websiteBlog: { available: boolean; reason?: string };
  /** Which destination a blog publish will use if the caller does not specify one. */
  defaultBlogDestination: BlogDestination | null;
  /** True when both providers are connected and the caller must choose. */
  blogDestinationRequired: boolean;
  social: Record<string, { available: boolean; reason?: string }>;
  connectedAccounts: Array<{ provider: string; accountHandle: string | null }>;
};

function schemaWarningFor(mode: WordPressJsonLdMode): string | undefined {
  switch (mode) {
    case 'PLUGIN':
      return undefined;
    case 'INLINE':
      return 'JSON-LD will be embedded in the post body. Install the Immortel Schema Bridge plugin for head-level schema.';
    case 'SEO_PLUGIN':
      return 'An SEO plugin controls structured data on this site — only the SEO title and description will be set.';
    default:
      return 'This site has no way to render JSON-LD. Posts will publish without schema.';
  }
}

export async function getPublishTargetsForBounty(
  companyId: string,
  bountyId: string,
): Promise<PublishTargetsData | null> {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId },
    select: { id: true },
  });

  if (!bounty) return null;

  const [shopify, wpSite, company] = await Promise.all([
    prisma.shopifyShop.findFirst({
      where: { companyId, status: 'installed' },
      select: { id: true },
    }),
    prisma.wordPressSite.findFirst({
      where: { companyId, status: 'connected' },
      orderBy: { updatedAt: 'desc' },
      select: { siteUrl: true, jsonLdMode: true },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultBlogDestination: true },
    }),
  ]);

  const shopifyAvailable = Boolean(shopify);
  const wordpressAvailable = Boolean(wpSite);

  const websiteBlogAvailability = await getPublishAdapter('WEBSITE_BLOG').isAvailable(companyId);

  const social: Record<string, { available: boolean; reason?: string }> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    social[platform] = await getPublishAdapter(platform).isAvailable(companyId);
  }

  const integrations = await prisma.socialIntegration.findMany({
    where: { companyId },
    select: { provider: true, accountHandle: true },
  });

  const preferred = parseBlogDestination(company?.defaultBlogDestination);
  const bothConnected = shopifyAvailable && wordpressAvailable;

  let defaultBlogDestination: BlogDestination | null = null;
  if (preferred && (preferred === 'shopify' ? shopifyAvailable : wordpressAvailable)) {
    defaultBlogDestination = preferred;
  } else if (shopifyAvailable !== wordpressAvailable) {
    defaultBlogDestination = shopifyAvailable ? 'shopify' : 'wordpress';
  }

  return {
    shopify: { available: shopifyAvailable },
    wordpress: {
      available: wordpressAvailable,
      reason: wordpressAvailable
        ? undefined
        : 'Connect WordPress under Profile → Integrations',
      ...(wpSite
        ? {
            siteUrl: wpSite.siteUrl,
            jsonLdMode: wpSite.jsonLdMode,
            schemaWarning: schemaWarningFor(wpSite.jsonLdMode),
          }
        : {}),
    },
    wordpressWoo: {
      available: wordpressAvailable,
      reason: wordpressAvailable ? undefined : 'WordPress is not connected',
    },
    websiteBlog: websiteBlogAvailability,
    defaultBlogDestination,
    blogDestinationRequired: bothConnected && defaultBlogDestination === null,
    social,
    connectedAccounts: integrations.map((i) => ({
      provider: i.provider,
      accountHandle: i.accountHandle,
    })),
  };
}
