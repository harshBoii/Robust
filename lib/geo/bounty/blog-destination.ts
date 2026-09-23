import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Website-blog destination resolution.
 *
 * Previously the publisher inferred its destination implicitly — Shopify won if a shop row
 * existed, WordPress was an unreachable fallthrough. That gave a company connected to both
 * no way to choose. Destination is now explicit, with the company default as the tiebreak.
 */

export type BlogDestination = 'shopify' | 'wordpress' | 'nextjs';

export const BLOG_DESTINATIONS: readonly BlogDestination[] = ['shopify', 'wordpress', 'nextjs'];

export const BLOG_DESTINATION_LABEL: Record<BlogDestination, string> = {
  shopify: 'Shopify',
  wordpress: 'WordPress',
  nextjs: 'Next.js site',
};

export type BlogConnectivity = Record<BlogDestination, boolean>;

export function parseBlogDestination(value: unknown): BlogDestination | null {
  return typeof value === 'string' && (BLOG_DESTINATIONS as readonly string[]).includes(value)
    ? (value as BlogDestination)
    : null;
}

export async function getBlogConnectivity(companyId: string): Promise<BlogConnectivity> {
  const [shopify, wordpress, nextjs] = await Promise.all([
    prisma.shopifyShop.findFirst({
      where: { companyId, status: 'installed' },
      select: { id: true },
    }),
    prisma.wordPressSite.findFirst({
      where: { companyId, status: 'connected' },
      select: { id: true },
    }),
    prisma.nextjsSite.findFirst({
      where: { companyId, status: 'connected' },
      select: { id: true },
    }),
  ]);
  return { shopify: Boolean(shopify), wordpress: Boolean(wordpress), nextjs: Boolean(nextjs) };
}

export function connectedBlogDestinations(connectivity: BlogConnectivity): BlogDestination[] {
  return BLOG_DESTINATIONS.filter((d) => connectivity[d]);
}

export type DestinationResolution =
  | { ok: true; destination: BlogDestination }
  | { ok: false; code: 'NO_BLOG_DESTINATION' | 'AMBIGUOUS_BLOG_DESTINATION'; reason: string };

/**
 * Resolve where a website blog should publish, in priority order:
 *   1. an explicit request-level choice
 *   2. the only connected provider
 *   3. the company's configured default (when that provider is actually connected)
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
        reason: `${BLOG_DESTINATION_LABEL[opts.requested]} is not connected for this workspace.`,
      };
    }
    return { ok: true, destination: opts.requested };
  }

  const connected = connectedBlogDestinations(connectivity);
  if (connected.length === 0) {
    return {
      ok: false,
      code: 'NO_BLOG_DESTINATION',
      reason:
        'Connect Shopify, WordPress or a Next.js site under Profile → Integrations to publish website blogs',
    };
  }
  if (connected.length === 1) {
    return { ok: true, destination: connected[0] };
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
    reason: `${connected.map((d) => BLOG_DESTINATION_LABEL[d]).join(', ')} are connected. Choose a destination, or set a default in Integrations.`,
  };
}
