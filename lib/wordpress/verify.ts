import 'server-only';

import { getWordPressTimeoutMs } from '@/lib/wordpress/domain';

/**
 * Post-publish schema verification.
 *
 * Sending JSON-LD is not the same as it being live. In INLINE mode WordPress silently
 * strips `<script>` via `wp_kses_post` for any user without `unfiltered_html`, and some
 * themes or caching layers can drop head output. So we fetch the rendered permalink and
 * confirm the block actually survived — the difference between "we sent schema" and
 * "schema is live".
 */

const LD_JSON_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export type SchemaVerification = {
  verified: boolean;
  /** How many ld+json blocks the rendered page contains (any source, including SEO plugins). */
  blockCount: number;
  reason?: string;
};

/**
 * Fetch `permalink` and look for our graph. Matching is by a stable marker from the graph
 * (the canonical URL) rather than exact string equality, because WP and SEO plugins may
 * reformat or merge the document before output.
 */
export async function verifyPublishedSchema(
  permalink: string,
  opts: { marker: string; timeoutMs?: number },
): Promise<SchemaVerification> {
  let html: string;
  try {
    const res = await fetch(permalink, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? getWordPressTimeoutMs()),
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) {
      return { verified: false, blockCount: 0, reason: `Permalink returned ${res.status}` };
    }
    html = await res.text();
  } catch (e) {
    return {
      verified: false,
      blockCount: 0,
      reason: e instanceof Error ? `Could not fetch permalink: ${e.message}` : 'Could not fetch permalink',
    };
  }

  const blocks = [...html.matchAll(LD_JSON_RE)].map((m) => m[1] ?? '');
  if (blocks.length === 0) {
    return { verified: false, blockCount: 0, reason: 'No application/ld+json block found' };
  }

  const found = blocks.some((b) => b.includes(opts.marker));
  return {
    verified: found,
    blockCount: blocks.length,
    reason: found ? undefined : 'JSON-LD present but does not reference this article',
  };
}
