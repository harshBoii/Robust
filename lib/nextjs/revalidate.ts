import 'server-only';

import { readRevalidateSecret, type NextjsSiteRow } from '@/lib/nextjs/site';
import { REVALIDATE_ROUTE } from '@/lib/nextjs/types';

export type RevalidateResult = { ok: true } | { ok: false; reason: string };

/**
 * Tell the customer site to drop its cached copy of the blog index (and one post) so a
 * publish shows up immediately instead of after the ISR window.
 */
export async function pingNextjsRevalidate(
  site: Pick<NextjsSiteRow, 'siteUrl' | 'basePath' | 'revalidateSecretEnc'>,
  body: { type: 'publish' | 'test'; slug?: string },
): Promise<RevalidateResult> {
  const secret = readRevalidateSecret(site);
  if (!secret) return { ok: false, reason: 'Revalidate secret could not be decrypted' };

  const paths = [site.basePath];
  if (body.slug) paths.push(`${site.basePath}/${body.slug}`);

  try {
    const res = await fetch(`${site.siteUrl.replace(/\/+$/, '')}${REVALIDATE_ROUTE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ ...body, paths }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
      redirect: 'follow',
    });
    if (res.status === 404) {
      return { ok: false, reason: `${REVALIDATE_ROUTE} was not found on the site — is the Robust starter installed?` };
    }
    if (res.status === 401) {
      return { ok: false, reason: 'The site rejected the revalidate secret — check ROBUST_REVALIDATE_SECRET' };
    }
    if (!res.ok) return { ok: false, reason: `Revalidate endpoint returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? `Could not reach the site: ${e.message}` : 'Could not reach the site',
    };
  }
}
