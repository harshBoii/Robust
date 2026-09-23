import 'server-only';

import { prisma } from '@/lib/prisma';
import { minimalMarkdownToHtml } from '@/lib/geo/bounty/markdownToHtmlForPublish';
import { canonicalUrlFor, type NextjsSiteRow } from '@/lib/nextjs/site';
import { linkifyMarkdownLinks, sanitizeArticleHtml } from '@/lib/nextjs/sanitize-html';
import type { BlogPost, BlogPostSummary } from '@/lib/nextjs/types';
import { buildArticleGraph } from '@/lib/wordpress/jsonld';

/**
 * Turns a stored AeoPage into the public blog contract (lib/nextjs/types.ts).
 *
 * facts / summary / claims are free-form JSON from the generation microservice, so each is
 * normalized defensively: unknown shapes degrade to empty values instead of leaking raw
 * JSON onto a customer's page.
 */

const PAGE_SELECT = {
  id: true,
  slug: true,
  title: true,
  seoTitle: true,
  seoDescription: true,
  description: true,
  summary: true,
  facts: true,
  faq: true,
  knowledgeGraph: true,
  publishedAt: true,
  nextjsPublishedAt: true,
  updatedAt: true,
  llm_topic_id: true,
  llm_topic: { select: { name: true } },
} as const;

type PageRow = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  description: string;
  summary: unknown;
  facts: unknown;
  faq: unknown;
  knowledgeGraph: unknown;
  publishedAt: Date | null;
  nextjsPublishedAt: Date | null;
  updatedAt: Date;
  llm_topic_id: string | null;
  llm_topic: { name: string } | null;
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function firstStr(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = str(obj[k]);
    if (v) return v;
  }
  return null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : isObj(x) ? firstStr(x, ['text', 'point', 'value']) : null))
    .filter((x): x is string => Boolean(x && x.trim()))
    .map((x) => x.trim());
}

export function normalizeSummary(v: unknown): BlogPost['summary'] {
  if (typeof v === 'string') return { text: str(v), points: [] };
  if (!isObj(v)) return { text: null, points: [] };
  return {
    text: firstStr(v, ['text', 'tldr', 'summary', 'answer', 'short_answer', 'shortAnswer', 'overview']),
    points: stringList(v.points ?? v.key_points ?? v.keyPoints ?? v.bullets ?? v.highlights),
  };
}

export function normalizeFacts(v: unknown): BlogPost['facts'] {
  if (!Array.isArray(v)) return [];
  const out: BlogPost['facts'] = [];
  for (const item of v) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ text: item.trim(), sourceUrl: null });
    } else if (isObj(item)) {
      const text = firstStr(item, ['text', 'fact', 'statement', 'claim', 'value', 'content']);
      if (!text) continue;
      const src = firstStr(item, ['sourceUrl', 'source_url', 'url', 'source']);
      out.push({ text, sourceUrl: src && /^https?:\/\//i.test(src) ? src : null });
    }
  }
  return out.slice(0, 20);
}

export function normalizeFaq(v: unknown): BlogPost['faq'] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .map((f) => ({
      question: firstStr(f, ['question', 'q']) ?? '',
      answer: firstStr(f, ['answer', 'a']) ?? '',
    }))
    .filter((f) => f.question && f.answer);
}

/**
 * minimalMarkdownToHtml already wraps every non-empty line in its own block, and turns
 * blank lines into stray `</p><p>` pairs — so drop blank lines first to get clean nesting.
 * A leading `# Title` is dropped too: the page renders the title itself.
 */
export function renderArticleHtml(markdown: string): string {
  const compact = markdown
    .replace(/\r\n/g, '\n')
    .replace(/^\s*# [^\n]*\n?/, '')
    .replace(/\n[ \t]*\n+/g, '\n')
    .trim();
  return sanitizeArticleHtml(linkifyMarkdownLinks(minimalMarkdownToHtml(compact)));
}

function toSummary(site: NextjsSiteRow, page: PageRow): BlogPostSummary {
  const published = page.nextjsPublishedAt ?? page.publishedAt ?? page.updatedAt;
  return {
    slug: page.slug,
    title: (page.title || page.seoTitle || page.slug).trim(),
    description: (page.seoDescription ?? '').trim(),
    topic: page.llm_topic?.name ?? null,
    canonicalUrl: canonicalUrlFor(site, page.slug),
    publishedAt: published.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

const publishedWhere = (site: NextjsSiteRow) => ({
  companyId: site.companyId,
  nextjsSiteId: site.id,
  nextjsPublishedAt: { not: null },
});

export async function listPublishedPosts(site: NextjsSiteRow): Promise<BlogPostSummary[]> {
  const pages = await prisma.aeoPage.findMany({
    where: publishedWhere(site),
    orderBy: { nextjsPublishedAt: 'desc' },
    take: 500,
    select: PAGE_SELECT,
  });
  return pages.map((p) => toSummary(site, p));
}

export async function getPublishedPost(site: NextjsSiteRow, slug: string): Promise<BlogPost | null> {
  const page = await prisma.aeoPage.findFirst({
    where: { ...publishedWhere(site), slug },
    orderBy: { nextjsPublishedAt: 'desc' },
    select: PAGE_SELECT,
  });
  if (!page) return null;
  return buildPost(site, page);
}

async function buildPost(site: NextjsSiteRow, page: PageRow): Promise<BlogPost> {
  const summary = toSummary(site, page);
  const company = await prisma.company.findUnique({
    where: { id: site.companyId },
    select: { name: true },
  });
  const authorName = company?.name?.trim() || new URL(site.siteUrl).hostname;

  const related = page.llm_topic_id
    ? await prisma.aeoPage.findMany({
        where: { ...publishedWhere(site), llm_topic_id: page.llm_topic_id, id: { not: page.id } },
        orderBy: { nextjsPublishedAt: 'desc' },
        take: 5,
        select: { slug: true, title: true },
      })
    : [];

  const faq = normalizeFaq(page.faq);
  const seoTitle = (page.seoTitle ?? page.title).trim();
  const seoDescription = (page.seoDescription ?? '').trim();

  const jsonLd = buildArticleGraph({
    knowledgeGraph: page.knowledgeGraph,
    canonicalUrl: summary.canonicalUrl,
    title: seoTitle,
    description: seoDescription,
    publishedAt: new Date(summary.publishedAt),
    modifiedAt: page.updatedAt,
    authorName,
    siteUrl: site.siteUrl,
    faq,
  });

  return {
    ...summary,
    seo: { title: seoTitle, description: seoDescription, canonicalUrl: summary.canonicalUrl },
    summary: normalizeSummary(page.summary),
    contentHtml: renderArticleHtml(page.description ?? ''),
    facts: normalizeFacts(page.facts),
    faq,
    jsonLd,
    author: { name: authorName, url: site.siteUrl },
    related: related.map((r) => ({
      slug: r.slug,
      title: r.title,
      canonicalUrl: canonicalUrlFor(site, r.slug),
    })),
  };
}
