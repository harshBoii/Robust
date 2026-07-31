/**
 * Paid Growth section membership and post-login landing.
 *
 * Every page in this section reads from the Meta Ads API, so without a connected Meta
 * integration they render an error rather than an empty state. Rather than let a new user
 * land there, we send them to Organic Marketing — which works with no integrations at all —
 * and gate the section itself behind an explanatory dialog.
 */

/** Where an unconnected user should land instead of the Paid Growth dashboard. */
export const ORGANIC_LANDING_PATH = '/organic/dashboard';

/** The Paid Growth dashboard, and the default landing for a connected user. */
export const PAID_GROWTH_LANDING_PATH = '/home';

/** Where the user finishes the Meta connection. */
export const INTEGRATIONS_PATH = '/profile/integration';

/**
 * Paths that genuinely require a Meta integration.
 *
 * Deliberately narrower than the Paid Growth nav section. Several pages that sit under
 * Paid Growth in the sidebar are not Meta-only, and gating them would break working
 * features for a user who has Google Ads or Shopify but not Meta:
 *
 *   /manager/history      — takes `platform=META|GOOGLE`; serves Google Ads history too
 *   /manager/post-google  — Google Ads composer
 *   /manager/google       — Google Ads
 *   /manager/shopify      — Shopify connection panel
 *   /manager/social       — social integrations
 *   /shop/*               — Shopify products
 *   /organic/rival-analysis — listed under Paid Growth, but reads no Meta data
 *
 * Note the exact match on `/manager/post`: a prefix test would also swallow
 * `/manager/post-google`.
 */
const META_REQUIRED_EXACT = new Set<string>([
  PAID_GROWTH_LANDING_PATH,
  '/manager/post',
  '/report',
]);

const META_REQUIRED_PREFIXES = [
  '/meta',
  '/manager/meta',
  '/manager/pending',
  '/manager/rules',
  '/manager/presets',
  '/create-ad',
];

export function isPaidGrowthPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (META_REQUIRED_EXACT.has(path)) return true;
  return META_REQUIRED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** A Meta integration is usable only once both an ad account and a page are selected. */
export function isMetaConnected(
  integration: { adAccountId?: string | null; fbPageId?: string | null } | null | undefined,
): boolean {
  return Boolean(integration?.adAccountId && integration?.fbPageId);
}
