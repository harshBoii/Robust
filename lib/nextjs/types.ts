/**
 * Public contract for GET /api/public/blog and /api/public/blog/[slug].
 *
 * This is consumed by customer Next.js sites (see lib/nextjs/claude-code-prompt.ts), so
 * changes must stay backwards compatible: only add optional fields, never rename/remove.
 */

export const NEXTJS_BLOG_API_VERSION = 1;

/** Route the starter template installs on the customer site; Robust POSTs here on publish. */
export const REVALIDATE_ROUTE = '/api/robust/revalidate';

export type BlogPostSummary = {
  slug: string;
  title: string;
  description: string;
  topic: string | null;
  canonicalUrl: string;
  publishedAt: string;
  updatedAt: string;
};

export type BlogPost = BlogPostSummary & {
  seo: {
    title: string;
    description: string;
    canonicalUrl: string;
  };
  /** Short answer / TL;DR paragraph, if the generator produced one. */
  summary: { text: string | null; points: string[] };
  /** Sanitized article body HTML (headings, paragraphs, lists, links, emphasis only). */
  contentHtml: string;
  facts: Array<{ text: string; sourceUrl: string | null }>;
  faq: Array<{ question: string; answer: string }>;
  /** schema.org graph (Article + FAQPage …) to render in a `<script type="application/ld+json">`. */
  jsonLd: Record<string, unknown>;
  author: { name: string; url: string };
  related: Array<{ slug: string; title: string; canonicalUrl: string }>;
};

export type BlogListResponse = {
  version: number;
  posts: BlogPostSummary[];
};

export type BlogPostResponse = {
  version: number;
  post: BlogPost;
};
