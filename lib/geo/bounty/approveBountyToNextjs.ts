import 'server-only';

import { prisma } from '@/lib/prisma';
import { syncBountyRevenueForCompany } from '@/lib/geo/radar/bountySync';
import { pingNextjsRevalidate } from '@/lib/nextjs/revalidate';
import { canonicalUrlFor, getConnectedNextjsSite } from '@/lib/nextjs/site';
import { verifyPublishedSchema } from '@/lib/wordpress/verify';

const LOG_PREFIX = '[geo/approve-nextjs]';

export type ApproveNextjsResult = {
  canonicalUrl: string;
  revalidated: boolean;
  schemaVerified: boolean | null;
  warnings: string[];
};

/**
 * Publish a bounty's generated page to the company's custom Next.js site.
 *
 * Unlike WordPress/Shopify nothing is pushed: marking the page published makes it visible
 * on /api/public/blog, which the customer site reads. We then ping the site's revalidate
 * endpoint so it re-fetches now, and confirm the JSON-LD actually rendered on the live URL.
 */
export async function approveBountyToNextjs(opts: {
  companyId: string;
  bountyId: string;
}): Promise<ApproveNextjsResult> {
  const warnings: string[] = [];

  const bounty = await prisma.citationBounty.findFirst({
    where: { id: opts.bountyId, companyId: opts.companyId },
    select: { id: true, aeoPage: { select: { id: true, slug: true, publishedAt: true, nextjsPublishedAt: true } } },
  });
  if (!bounty?.aeoPage) {
    throw new Error('Bounty or generated page not found');
  }

  const site = await getConnectedNextjsSite(opts.companyId);
  if (!site) {
    throw new Error('Next.js site is not connected. Connect it under Profile → Integrations.');
  }

  const aeoPage = bounty.aeoPage;
  const canonicalUrl = canonicalUrlFor(site, aeoPage.slug);
  const now = new Date();

  await prisma.aeoPage.update({
    where: { id: aeoPage.id },
    data: {
      canonicalUrl: canonicalUrl.slice(0, 1000),
      nextjsSiteId: site.id,
      nextjsPublishedAt: aeoPage.nextjsPublishedAt ?? now,
      ...(aeoPage.publishedAt ? {} : { publishedAt: now }),
    },
  });

  // ── Revalidate + verify ────────────────────────────────────────────────────
  const revalidate = await pingNextjsRevalidate(site, { type: 'publish', slug: aeoPage.slug });
  if (!revalidate.ok) {
    warnings.push(
      `Published, but the site could not be refreshed (${revalidate.reason}). It will appear once the site's cache expires.`,
    );
  }

  let schemaVerified: boolean | null = null;
  if (revalidate.ok) {
    const verification = await verifyPublishedSchema(canonicalUrl, { marker: canonicalUrl });
    schemaVerified = verification.verified;
    if (!verification.verified) {
      const detail = verification.reason ? ` (${verification.reason})` : '';
      warnings.push(`Published, but the JSON-LD schema could not be confirmed on the live page${detail}.`);
    }
  }

  await prisma.nextjsSite
    .update({
      where: { id: site.id },
      data: revalidate.ok
        ? { lastVerifiedAt: now, lastError: null }
        : { lastError: revalidate.reason.slice(0, 1000) },
    })
    .catch((e) => console.warn(`${LOG_PREFIX} could not record site status`, e));

  await prisma.citationBounty.update({
    where: { id: opts.bountyId },
    data: { publishedAt: now },
  });
  await syncBountyRevenueForCompany(prisma, opts.companyId);

  return { canonicalUrl, revalidated: revalidate.ok, schemaVerified, warnings };
}
