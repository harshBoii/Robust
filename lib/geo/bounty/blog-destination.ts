import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Website-blog destination resolution.
 *
 * Previously the publisher inferred its destination implicitly — Shopify won if a shop row
 * existed, WordPress was an unreachable fallthrough. That gave a company connected to both
 * no way to choose. Destination is now explicit, with the company default as the tiebreak.
 */

export type BlogDestination = 'shopify' | 'wordpress';

export type BlogConnectivity = {
  shopify: boolean;
  wordpress: boolean;
};

export function parseBlogDestination(value: unknown): BlogDestination | null {
  return value === 'shopify' || value === 'wordpress' ? value : null;
}

export async function getBlogConnectivity(companyId: string): Promise<BlogConnectivity> {
  const [shopify, wordpress] = await Promise.all([
    prisma.shopifyShop.findFirst({
      where: { companyId, status: 'installed' },
      select: { id: true },
    }),
    prisma.wordPressSite.findFirst({
      where: { companyId, status: 'connected' },
      select: { id: true },
    }),
  ]);
  return { shopify: Boolean(shopify), wordpress: Boolean(wordpress) };
}

export type DestinationResolution =
  | { ok: true; destination: BlogDestination }
  | { ok: false; code: 'NO_BLOG_DESTINATION' | 'AMBIGUOUS_BLOG_DESTINATION'; reason: string };

/**
 * Resolve where a website blog should publish, in priority order:
 *   1. an explicit request-level choice
 *   2. the company's configured default (when that provider is actually connected)
 *   3. the only connected provider
 *   4. otherwise: ambiguous, and the caller must ask
 */
export async function resolveBlogDestination(opts: {
  companyId: string;
  requested?: BlogDestination | null;
  connectivity?: BlogConnectivity;
}): Promise<DestinationResolution> {
  const connectivity = opts.connectivity ?? (await getBlogConnectivity(opts.companyId));

  if (opts.requested) {
    if (!connectivity[opts.requested]) {
      return {
        ok: false,
        code: 'NO_BLOG_DESTINATION',
        reason:
          opts.requested === 'shopify'
            ? 'Shopify is not connected for this workspace.'
            : 'WordPress is not connected for this workspace.',
      };
    }
    return { ok: true, destination: opts.requested };
  }

  if (!connectivity.shopify && !connectivity.wordpress) {
    return {
      ok: false,
      code: 'NO_BLOG_DESTINATION',
      reason: 'Connect Shopify or WordPress under Profile → Integrations to publish website blogs',
    };
  }

  if (connectivity.shopify !== connectivity.wordpress) {
    return { ok: true, destination: connectivity.shopify ? 'shopify' : 'wordpress' };
  }

  const company = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { defaultBlogDestination: true },
  });
  const preferred = parseBlogDestination(company?.defaultBlogDestination);
  if (preferred && connectivity[preferred]) {
    return { ok: true, destination: preferred };
  }

  return {
    ok: false,
    code: 'AMBIGUOUS_BLOG_DESTINATION',
    reason:
      'Both Shopify and WordPress are connected. Choose a destination, or set a default in Integrations.',
  };
}
