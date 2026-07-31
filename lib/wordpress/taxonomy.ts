import 'server-only';

import { prisma } from '@/lib/prisma';
import { wpFetch } from '@/lib/wordpress/client';
import type { WordPressContext } from '@/lib/wordpress/config';
import { WordPressApiError } from '@/lib/wordpress/errors';
import { channelTitleFromSlug } from '@/lib/geo/bounty/topic-slug';

/**
 * Category and tag resolution.
 *
 * WordPress requires numeric term IDs on `POST /wp/v2/posts` — it will not accept slugs or
 * names. So every publish needs terms resolved to IDs first. Categories are cached in
 * `WordPressBlogChannel` (the analogue of `ShopifyBlogChannel`); tags are cheap enough to
 * resolve per-publish.
 */

type WpTerm = { id: number; slug: string; name: string };

/** WP's slug for "already exists", returned with the existing term id in `data.term_id`. */
const TERM_EXISTS = 'term_exists';

function existingTermIdFromError(e: unknown): number | null {
  if (!(e instanceof WordPressApiError)) return null;
  if (e.wpCode !== TERM_EXISTS) return null;
  const body = e.body as { data?: { term_id?: number } | number } | undefined;
  if (typeof body?.data === 'object' && typeof body.data?.term_id === 'number') {
    return body.data.term_id;
  }
  return null;
}

async function findTermBySlug(
  ctx: WordPressContext,
  taxonomy: 'categories' | 'tags',
  slug: string,
): Promise<WpTerm | null> {
  const found = await wpFetch<WpTerm[]>(ctx, {
    path: `/${taxonomy}`,
    query: { slug, per_page: '1', _fields: 'id,slug,name' },
  });
  return Array.isArray(found) && found[0] ? found[0] : null;
}

async function createTerm(
  ctx: WordPressContext,
  taxonomy: 'categories' | 'tags',
  input: { slug: string; name: string },
): Promise<number> {
  try {
    const created = await wpFetch<WpTerm>(ctx, {
      method: 'POST',
      path: `/${taxonomy}`,
      body: { name: input.name, slug: input.slug },
    });
    return created.id;
  } catch (e) {
    // Racing publishes can both miss the lookup and both try to create.
    const existingId = existingTermIdFromError(e);
    if (existingId) return existingId;

    // Some hardened sites forbid term creation but allow posting to existing terms.
    if (e instanceof WordPressApiError && e.code === 'WP_FORBIDDEN') {
      const fallback = await findTermBySlug(ctx, taxonomy, input.slug).catch(() => null);
      if (fallback) return fallback.id;
    }
    throw e;
  }
}

/**
 * Resolve the category for a topic, creating it if needed, and cache the numeric ID.
 * Mirrors `ensureBlogChannel` in the Shopify path.
 */
export async function ensureCategory(
  ctx: WordPressContext,
  opts: { slug: string; name?: string | null },
): Promise<{ categoryId: number; existing: boolean }> {
  const cached = await prisma.wordPressBlogChannel.findUnique({
    where: { siteId_slug: { siteId: ctx.siteId, slug: opts.slug } },
    select: { wpCategoryId: true },
  });
  if (cached) return { categoryId: cached.wpCategoryId, existing: true };

  const name = channelTitleFromSlug(opts.slug, opts.name);

  // The category may already exist on the site from a previous connection or manual setup.
  const remote = await findTermBySlug(ctx, 'categories', opts.slug).catch(() => null);
  const categoryId = remote?.id ?? (await createTerm(ctx, 'categories', { slug: opts.slug, name }));

  await prisma.wordPressBlogChannel.upsert({
    where: { siteId_slug: { siteId: ctx.siteId, slug: opts.slug } },
    create: {
      siteId: ctx.siteId,
      companyId: ctx.companyId,
      slug: opts.slug,
      name,
      wpCategoryId: categoryId,
    },
    update: { wpCategoryId: categoryId, name },
  });

  return { categoryId, existing: Boolean(remote) };
}

/**
 * Resolve tag names to IDs, creating any that are missing.
 * Failures are non-fatal: tags are cosmetic and must never block a publish.
 */
export async function ensureTags(
  ctx: WordPressContext,
  names: string[],
): Promise<number[]> {
  const ids: number[] = [];

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) continue;

    try {
      const existing = await findTermBySlug(ctx, 'tags', slug);
      ids.push(existing ? existing.id : await createTerm(ctx, 'tags', { slug, name }));
    } catch {
      // Skip this tag, keep the rest.
    }
  }

  return ids;
}
