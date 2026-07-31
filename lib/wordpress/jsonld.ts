import { WordPressJsonLdMode } from '@/app/generated/prisma/enums';

import { META_JSON_LD, META_PAYLOAD } from '@/lib/wordpress/capabilities';
import type { WpPostInput } from '@/lib/wordpress/posts';

/**
 * JSON-LD construction and delivery for WordPress.
 *
 * `AeoPage.knowledgeGraph` is the source of truth — it is whatever the generation
 * microservice produced (`page.jsonLd`). We treat it as authoritative and only ever
 * *backfill* fields it omitted, never overwrite what it asserted. When it is empty we
 * synthesize a minimal Article/FAQPage graph so the post is not published bare.
 */

export type FaqItem = { question: string; answer: string };

export type BuildGraphInput = {
  knowledgeGraph: unknown;
  canonicalUrl: string;
  title: string;
  description: string;
  publishedAt: Date | null;
  modifiedAt: Date;
  authorName: string;
  siteUrl: string;
  faq?: unknown;
};

function parseFaq(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  const items: FaqItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const question = typeof row.question === 'string' ? row.question.trim() : '';
    const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
    if (!question || !answer) continue;
    items.push({ question, answer });
  }
  return items;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isEmptyGraph(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function buildFaqNode(faq: FaqItem[]): Record<string, unknown> | null {
  if (faq.length === 0) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

function buildArticleNode(input: BuildGraphInput): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'Article',
    headline: input.title,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.canonicalUrl },
    url: input.canonicalUrl,
    dateModified: input.modifiedAt.toISOString(),
    author: { '@type': 'Person', name: input.authorName },
    publisher: { '@type': 'Organization', name: input.authorName, url: input.siteUrl },
  };
  if (input.description) node.description = input.description;
  if (input.publishedAt) node.datePublished = input.publishedAt.toISOString();
  return node;
}

/**
 * Backfill URL/date fields onto whichever node in an existing graph represents the article.
 * Only fills gaps — an explicit value from the generator always wins.
 */
function backfillNode(node: Record<string, unknown>, input: BuildGraphInput): void {
  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  const isArticleish = types.some(
    (t) => typeof t === 'string' && /Article|BlogPosting|WebPage/i.test(t),
  );
  if (!isArticleish) return;

  if (!node.url) node.url = input.canonicalUrl;
  if (!node.mainEntityOfPage) {
    node.mainEntityOfPage = { '@type': 'WebPage', '@id': input.canonicalUrl };
  }
  if (!node.datePublished && input.publishedAt) {
    node.datePublished = input.publishedAt.toISOString();
  }
  if (!node.dateModified) node.dateModified = input.modifiedAt.toISOString();
  if (!node.headline && input.title) node.headline = input.title;
}

/**
 * Produce the final JSON-LD document to publish.
 *
 * - Existing `@graph` → backfill each node, append an FAQPage if the generator omitted one.
 * - Existing single node with `@context` → wrap into a graph, then backfill.
 * - Empty → synthesize Article (+ FAQPage).
 */
export function buildArticleGraph(input: BuildGraphInput): Record<string, unknown> {
  const faq = parseFaq(input.faq);
  const faqNode = buildFaqNode(faq);

  if (!isEmptyGraph(input.knowledgeGraph)) {
    const source = input.knowledgeGraph;

    // Case 1: already a full document with @graph.
    if (isPlainObject(source) && Array.isArray(source['@graph'])) {
      const nodes = (source['@graph'] as unknown[]).map((n) =>
        isPlainObject(n) ? { ...n } : n,
      );
      for (const n of nodes) if (isPlainObject(n)) backfillNode(n, input);

      const hasFaq = nodes.some(
        (n) => isPlainObject(n) && String(n['@type'] ?? '').includes('FAQPage'),
      );
      if (faqNode && !hasFaq) nodes.push(faqNode);

      return {
        '@context': source['@context'] ?? 'https://schema.org',
        ...source,
        '@graph': nodes,
      };
    }

    // Case 2: a bare array of nodes.
    if (Array.isArray(source)) {
      const nodes = source.map((n) => (isPlainObject(n) ? { ...n } : n));
      for (const n of nodes) if (isPlainObject(n)) backfillNode(n, input);
      if (faqNode) nodes.push(faqNode);
      return { '@context': 'https://schema.org', '@graph': nodes };
    }

    // Case 3: a single node object.
    if (isPlainObject(source)) {
      const node = { ...source };
      const context = node['@context'] ?? 'https://schema.org';
      delete node['@context'];
      backfillNode(node, input);
      const nodes: unknown[] = [node];
      if (faqNode) nodes.push(faqNode);
      return { '@context': context, '@graph': nodes };
    }
  }

  // Case 4: nothing usable — synthesize.
  const nodes: unknown[] = [buildArticleNode(input)];
  if (faqNode) nodes.push(faqNode);
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** Serialize and round-trip validate, mirroring the Shopify path's JSON guard. */
export function serializeGraph(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  let str: string;
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return { ok: false, error: 'Value is not JSON-serializable' };
  }
  if (!str) return { ok: false, error: 'Value serialized to empty string' };
  try {
    JSON.parse(str);
  } catch {
    return { ok: false, error: 'Value must be valid JSON' };
  }
  return { ok: true, value: str };
}

/**
 * Render an inline `<script type="application/ld+json">` block.
 *
 * `<` is escaped to `<` so a `</script>` sequence inside any string value cannot
 * terminate the block early — the standard JSON-LD embedding hazard. The result contains
 * no raw `<` other than the tags themselves.
 */
export function renderInlineJsonLd(json: string): string {
  const safe = json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `\n<script type="application/ld+json">${safe}</script>\n`;
}

export type AttachResult = {
  /** Post fields to merge into the create/update body. */
  patch: Partial<WpPostInput>;
  /** True when schema is actually being delivered by this mode. */
  schemaAttached: boolean;
  /** Set when the mode cannot carry the graph, for surfacing in the UI. */
  warning?: string;
};

/**
 * Decide how the graph rides along with the post, given the site's resolved capability.
 *
 * PLUGIN     → post meta; the plugin prints it into `<head>` and merges with Yoast/Rank Math.
 * INLINE     → appended to content; requires `unfiltered_html` or WP strips the tag.
 * SEO_PLUGIN → the SEO plugin owns the graph; we only supply title/description.
 * UNAVAILABLE→ publish bare and warn.
 */
export function attachJsonLd(opts: {
  mode: WordPressJsonLdMode;
  graphJson: string;
  payloadJson: string | null;
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoPlugin: 'yoast' | 'rankmath' | null;
}): AttachResult {
  switch (opts.mode) {
    case WordPressJsonLdMode.PLUGIN: {
      const meta: Record<string, unknown> = { [META_JSON_LD]: opts.graphJson };
      if (opts.payloadJson) meta[META_PAYLOAD] = opts.payloadJson;
      return {
        patch: { meta: { ...meta, ...seoPluginMeta(opts) } },
        schemaAttached: true,
      };
    }

    case WordPressJsonLdMode.INLINE: {
      return {
        patch: {
          content: `${opts.content}${renderInlineJsonLd(opts.graphJson)}`,
          meta: seoPluginMeta(opts),
        },
        schemaAttached: true,
      };
    }

    case WordPressJsonLdMode.SEO_PLUGIN: {
      return {
        patch: { meta: seoPluginMeta(opts) },
        schemaAttached: false,
        warning:
          `Schema graph was not attached: ${opts.seoPlugin ?? 'the SEO plugin'} controls ` +
          'structured data on this site. Install the Immortel Schema Bridge plugin for full JSON-LD.',
      };
    }

    default: {
      return {
        patch: {},
        schemaAttached: false,
        warning:
          'Schema graph was not attached: this site has no way to render JSON-LD. ' +
          'Install the Immortel Schema Bridge plugin, or publish as a user with the ' +
          'unfiltered_html capability.',
      };
    }
  }
}

/** SEO title/description meta keys for whichever SEO plugin is present. */
function seoPluginMeta(opts: {
  seoPlugin: 'yoast' | 'rankmath' | null;
  seoTitle: string;
  seoDescription: string;
}): Record<string, unknown> {
  if (!opts.seoTitle && !opts.seoDescription) return {};
  if (opts.seoPlugin === 'yoast') {
    return {
      ...(opts.seoTitle ? { _yoast_wpseo_title: opts.seoTitle } : {}),
      ...(opts.seoDescription ? { _yoast_wpseo_metadesc: opts.seoDescription } : {}),
    };
  }
  if (opts.seoPlugin === 'rankmath') {
    return {
      ...(opts.seoTitle ? { rank_math_title: opts.seoTitle } : {}),
      ...(opts.seoDescription ? { rank_math_description: opts.seoDescription } : {}),
    };
  }
  return {};
}
