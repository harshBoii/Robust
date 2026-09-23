/**
 * Reference implementation installed on a customer's Next.js (App Router) site.
 *
 * Embedded verbatim in the Claude Code setup prompt (claude-code-prompt.ts). `__BASE_PATH__`
 * is replaced with the site's blog prefix (e.g. /blog). Written with String.raw and without
 * template literals so the content can be copied byte-for-byte.
 *
 * Contract it relies on: lib/nextjs/types.ts and REVALIDATE_ROUTE in lib/nextjs/types.ts.
 */

export type StarterFile = { path: string; description: string; content: string };

const BLOG_LIB = String.raw`// Robust blog client — fetches articles published from Robust (https://www.tryrobust.com).
// Server-only: reads ROBUST_API_KEY, never import this from a client component.

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
  seo: { title: string; description: string; canonicalUrl: string };
  summary: { text: string | null; points: string[] };
  contentHtml: string;
  facts: Array<{ text: string; sourceUrl: string | null }>;
  faq: Array<{ question: string; answer: string }>;
  jsonLd: Record<string, unknown>;
  author: { name: string; url: string };
  related: Array<{ slug: string; title: string; canonicalUrl: string }>;
};

/** Route prefix the blog is served under. Must match the "Blog path" set in Robust. */
export const BLOG_BASE_PATH = '__BASE_PATH__';

/** Fallback cache window. Robust also pings /api/robust/revalidate on every publish. */
export const BLOG_REVALIDATE_SECONDS = 3600;

const API_URL = (process.env.ROBUST_API_URL || 'https://www.tryrobust.com').replace(/\/+$/, '');

const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

async function robustFetch<T>(path: string): Promise<T | null> {
  const key = process.env.ROBUST_API_KEY;
  if (!key) {
    console.warn('[robust] ROBUST_API_KEY is not set; the blog will be empty.');
    return null;
  }
  try {
    const res = await fetch(API_URL + path, {
      headers: { Authorization: 'Bearer ' + key },
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('[robust] ' + path + ' returned ' + res.status);
    return (await res.json()) as T;
  } catch (error) {
    // Never fail the site's build because the blog API is unreachable. At runtime we
    // rethrow so ISR keeps serving the last good version instead of caching an error.
    if (isBuild) {
      console.warn('[robust] blog fetch failed during build:', error);
      return null;
    }
    throw error;
  }
}

export async function getPosts(): Promise<BlogPostSummary[]> {
  const data = await robustFetch<{ posts: BlogPostSummary[] }>('/api/public/blog');
  return data?.posts ?? [];
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const data = await robustFetch<{ post: BlogPost }>('/api/public/blog/' + encodeURIComponent(slug));
  return data?.post ?? null;
}

export function postPath(slug: string): string {
  return BLOG_BASE_PATH + '/' + slug;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Serialize JSON-LD for a script tag; escaping '<' prevents breaking out of the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
`;

const INDEX_PAGE = String.raw`import type { Metadata } from 'next';
import Link from 'next/link';

import { BLOG_BASE_PATH, formatDate, getPosts, postPath } from '@/lib/robust/blog';
import styles from './robust-blog.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Guides, answers and insights from our team.',
  alternates: { canonical: BLOG_BASE_PATH },
};

export default async function BlogIndexPage() {
  const posts = await getPosts();

  return (
    <main className={styles.root}>
      <div className={styles.wide}>
        <header className={styles.indexHeader}>
          <p className={styles.eyebrow}>Blog</p>
          <h1 className={styles.title}>Guides &amp; answers</h1>
          <p className={styles.lede}>Clear, researched answers to the questions our customers ask most.</p>
        </header>

        {posts.length === 0 ? (
          <p className={styles.empty}>No articles yet — check back soon.</p>
        ) : (
          <ul className={styles.grid}>
            {posts.map((post) => (
              <li key={post.slug}>
                <Link href={postPath(post.slug)} className={styles.card}>
                  {post.topic ? <span className={styles.pill}>{post.topic}</span> : null}
                  <h2 className={styles.cardTitle}>{post.title}</h2>
                  {post.description ? <p className={styles.cardText}>{post.description}</p> : null}
                  <span className={styles.cardMeta}>
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                    <span aria-hidden="true" className={styles.readMore}>Read →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
`;

const POST_PAGE = String.raw`import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BLOG_BASE_PATH, formatDate, getPost, getPosts, jsonLdScript, postPath } from '@/lib/robust/blog';
import styles from '../robust-blog.module.css';

export const revalidate = 3600;
// Posts published after the last deploy are rendered on first request, then cached.
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const description = post.seo.description || undefined;
  return {
    title: post.seo.title,
    description,
    alternates: { canonical: post.seo.canonicalUrl },
    openGraph: {
      type: 'article',
      title: post.seo.title,
      description,
      url: post.seo.canonicalUrl,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
    },
    twitter: { card: 'summary_large_image', title: post.seo.title, description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const updated = formatDate(post.updatedAt);
  const published = formatDate(post.publishedAt);
  const hasSummary = Boolean(post.summary.text) || post.summary.points.length > 0;

  return (
    <main className={styles.root}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(post.jsonLd) }}
      />

      <article className={styles.article}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={BLOG_BASE_PATH}>Blog</Link>
          {post.topic ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{post.topic}</span>
            </>
          ) : null}
        </nav>

        <header className={styles.header}>
          {post.topic ? <p className={styles.eyebrow}>{post.topic}</p> : null}
          <h1 className={styles.title}>{post.title}</h1>
          {post.description ? <p className={styles.lede}>{post.description}</p> : null}
          <p className={styles.meta}>
            <span>By {post.author.name}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedAt}>{published}</time>
            {updated !== published ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Updated <time dateTime={post.updatedAt}>{updated}</time>
                </span>
              </>
            ) : null}
          </p>
        </header>

        {hasSummary ? (
          <aside className={styles.summary} aria-label="Quick answer">
            <p className={styles.summaryLabel}>Quick answer</p>
            {post.summary.text ? <p className={styles.summaryText}>{post.summary.text}</p> : null}
            {post.summary.points.length > 0 ? (
              <ul className={styles.summaryPoints}>
                {post.summary.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : null}
          </aside>
        ) : null}

        <div className={styles.content} dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

        {post.facts.length > 0 ? (
          <section className={styles.section} aria-labelledby="key-facts">
            <h2 id="key-facts" className={styles.sectionTitle}>Key facts</h2>
            <ul className={styles.facts}>
              {post.facts.map((fact) => (
                <li key={fact.text}>
                  <span>{fact.text}</span>
                  {fact.sourceUrl ? (
                    <a href={fact.sourceUrl} className={styles.source} target="_blank" rel="noopener noreferrer nofollow">
                      Source
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {post.faq.length > 0 ? (
          <section className={styles.section} aria-labelledby="faq">
            <h2 id="faq" className={styles.sectionTitle}>Frequently asked questions</h2>
            <div className={styles.faq}>
              {post.faq.map((item, index) => (
                <details key={item.question} className={styles.faqItem} open={index === 0}>
                  <summary className={styles.faqQuestion}>{item.question}</summary>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {post.related.length > 0 ? (
          <section className={styles.section} aria-labelledby="related">
            <h2 id="related" className={styles.sectionTitle}>Related articles</h2>
            <ul className={styles.related}>
              {post.related.map((item) => (
                <li key={item.slug}>
                  <Link href={postPath(item.slug)}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <Link href={BLOG_BASE_PATH}>← All articles</Link>
        </footer>
      </article>
    </main>
  );
}
`;

const STYLES = String.raw`/* Robust blog — self-contained styles. Tweak the variables to match your brand. */

.root {
  --rb-accent: #6d28d9;
  --rb-fg: #0f172a;
  --rb-muted: #64748b;
  --rb-border: #e2e8f0;
  --rb-surface: #f8fafc;
  --rb-radius: 14px;
  color: var(--rb-fg);
  padding: 48px 20px 96px;
  overflow-wrap: break-word;
}

@media (prefers-color-scheme: dark) {
  .root {
    --rb-accent: #a78bfa;
    --rb-fg: #e2e8f0;
    --rb-muted: #94a3b8;
    --rb-border: #1e293b;
    --rb-surface: #0f172a;
  }
}

:global(.dark) .root {
  --rb-accent: #a78bfa;
  --rb-fg: #e2e8f0;
  --rb-muted: #94a3b8;
  --rb-border: #1e293b;
  --rb-surface: #0f172a;
}

:global(.light) .root {
  --rb-accent: #6d28d9;
  --rb-fg: #0f172a;
  --rb-muted: #64748b;
  --rb-border: #e2e8f0;
  --rb-surface: #f8fafc;
}

.wide { max-width: 1080px; margin: 0 auto; }
.article { max-width: 720px; margin: 0 auto; }

.breadcrumb {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  font-size: 13px; color: var(--rb-muted); margin-bottom: 28px;
}
.breadcrumb a { color: inherit; text-decoration: none; }
.breadcrumb a:hover { color: var(--rb-accent); }

.header, .indexHeader { margin-bottom: 32px; }
.indexHeader { text-align: center; margin-bottom: 48px; }

.eyebrow {
  margin: 0 0 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--rb-accent);
}
.title {
  margin: 0; font-size: clamp(2rem, 4vw, 2.75rem); line-height: 1.15;
  letter-spacing: -0.02em; font-weight: 750;
}
.lede { margin: 16px 0 0; font-size: 1.15rem; line-height: 1.6; color: var(--rb-muted); }
.meta {
  display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 0;
  font-size: 14px; color: var(--rb-muted);
}

.summary {
  margin: 0 0 40px; padding: 20px 24px; border-radius: var(--rb-radius);
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  border-left: 4px solid var(--rb-accent);
}
.summaryLabel {
  margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--rb-accent);
}
.summaryText { margin: 0; font-size: 1.05rem; line-height: 1.7; }
.summaryPoints { margin: 12px 0 0; padding-left: 20px; line-height: 1.7; }

.content { font-size: 1.075rem; line-height: 1.8; }
.content h2 { font-size: 1.6rem; line-height: 1.3; margin: 2.2em 0 0.6em; letter-spacing: -0.01em; }
.content h3 { font-size: 1.25rem; line-height: 1.4; margin: 1.8em 0 0.5em; }
.content h4 { font-size: 1.05rem; margin: 1.6em 0 0.4em; }
.content p { margin: 0 0 1.2em; }
.content ul, .content ol { margin: 0 0 1.4em; padding-left: 1.4em; }
.content li { margin: 0.35em 0; }
.content a { color: var(--rb-accent); text-underline-offset: 3px; }
.content strong { font-weight: 700; }
.content blockquote {
  margin: 1.6em 0; padding: 4px 0 4px 20px; border-left: 3px solid var(--rb-border);
  color: var(--rb-muted); font-style: italic;
}
.content code {
  font-size: 0.9em; padding: 2px 6px; border-radius: 6px; background: var(--rb-surface);
  border: 1px solid var(--rb-border);
}
.content pre { overflow-x: auto; padding: 16px; border-radius: 10px; background: var(--rb-surface); }
.content table { width: 100%; border-collapse: collapse; margin: 1.6em 0; font-size: 0.95rem; }
.content th, .content td { padding: 10px 12px; border-bottom: 1px solid var(--rb-border); text-align: left; }
.content hr { border: 0; border-top: 1px solid var(--rb-border); margin: 2.4em 0; }

.section { margin-top: 56px; }
.sectionTitle { font-size: 1.5rem; line-height: 1.3; margin: 0 0 20px; letter-spacing: -0.01em; }

.facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.facts li {
  display: flex; gap: 12px; align-items: baseline; justify-content: space-between;
  padding: 14px 18px; border-radius: 12px; border: 1px solid var(--rb-border); line-height: 1.6;
}
.facts li::before { content: "✓"; color: var(--rb-accent); font-weight: 700; flex: none; }
.facts li > span { flex: 1; }
.source { flex: none; font-size: 13px; color: var(--rb-muted); }
.source:hover { color: var(--rb-accent); }

.faq { border-top: 1px solid var(--rb-border); }
.faqItem { border-bottom: 1px solid var(--rb-border); }
.faqQuestion {
  cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 16px;
  padding: 18px 0; font-weight: 650; font-size: 1.05rem; line-height: 1.5;
}
.faqQuestion::-webkit-details-marker { display: none; }
.faqQuestion::after {
  content: "+"; flex: none; width: 1em; text-align: center; font-size: 1.4rem; line-height: 1;
  color: var(--rb-accent); transition: transform 0.2s ease;
}
.faqItem[open] .faqQuestion::after { transform: rotate(45deg); }
.faqAnswer { margin: 0 0 20px; line-height: 1.75; color: var(--rb-muted); }

.related { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.related a {
  display: block; padding: 14px 18px; border-radius: 12px; border: 1px solid var(--rb-border);
  color: inherit; text-decoration: none; font-weight: 600;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.related a:hover { border-color: var(--rb-accent); color: var(--rb-accent); }

.footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--rb-border); }
.footer a { color: var(--rb-accent); text-decoration: none; font-weight: 600; }

.grid {
  list-style: none; margin: 0; padding: 0; display: grid; gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.card {
  display: flex; flex-direction: column; gap: 10px; height: 100%; padding: 24px;
  border-radius: var(--rb-radius); border: 1px solid var(--rb-border); color: inherit;
  text-decoration: none; transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  transform: translateY(-2px); border-color: var(--rb-accent);
  box-shadow: 0 12px 32px -16px rgba(15, 23, 42, 0.25);
}
.pill {
  align-self: flex-start; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
  color: var(--rb-accent); background: var(--rb-surface); border: 1px solid var(--rb-border);
}
.cardTitle { margin: 0; font-size: 1.2rem; line-height: 1.35; font-weight: 700; }
.cardText {
  margin: 0; color: var(--rb-muted); line-height: 1.6; font-size: 0.95rem;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.cardMeta {
  margin-top: auto; padding-top: 8px; display: flex; justify-content: space-between;
  font-size: 13px; color: var(--rb-muted);
}
.readMore { color: var(--rb-accent); font-weight: 600; }
.empty { text-align: center; color: var(--rb-muted); padding: 48px 0; }

@media (max-width: 640px) {
  .root { padding: 32px 16px 72px; }
  .summary { padding: 16px 18px; }
  .facts li { flex-wrap: wrap; }
}
`;

const REVALIDATE_ROUTE = String.raw`import { timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { BLOG_BASE_PATH } from '@/lib/robust/blog';

// Called by Robust whenever an article is published so it appears immediately.
// Body: { type: 'publish' | 'test', slug?: string, paths?: string[] }

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  const secret = process.env.ROBUST_REVALIDATE_SECRET;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret || !token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { type?: string; paths?: unknown };
  const requested = Array.isArray(body.paths) ? body.paths : [];
  // Only ever revalidate blog routes, whatever the caller asks for.
  const paths = requested.filter(
    (p): p is string =>
      typeof p === 'string' && (p === BLOG_BASE_PATH || p.startsWith(BLOG_BASE_PATH + '/')),
  );
  if (!paths.includes(BLOG_BASE_PATH)) paths.push(BLOG_BASE_PATH);

  for (const path of paths) revalidatePath(path);
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ revalidated: true, type: body.type ?? 'publish', paths });
}
`;

const SITEMAP_SNIPPET = String.raw`import type { MetadataRoute } from 'next';

import { getPosts } from '@/lib/robust/blog';

// Merge these entries into your existing sitemap if you already have one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();
  return posts.map((post) => ({
    url: post.canonicalUrl,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));
}
`;

export function nextjsStarterFiles(basePath: string): StarterFile[] {
  const dir = `app${basePath}`;
  const fill = (s: string) => s.split('__BASE_PATH__').join(basePath);
  return [
    { path: 'lib/robust/blog.ts', description: 'API client, types and helpers', content: fill(BLOG_LIB) },
    { path: `${dir}/page.tsx`, description: 'Blog index page', content: fill(INDEX_PAGE) },
    { path: `${dir}/[slug]/page.tsx`, description: 'Article page with FAQ, facts and JSON-LD', content: fill(POST_PAGE) },
    { path: `${dir}/robust-blog.module.css`, description: 'Scoped styles for the blog', content: STYLES },
    { path: 'app/api/robust/revalidate/route.ts', description: 'Revalidation webhook Robust calls on publish', content: fill(REVALIDATE_ROUTE) },
    { path: 'app/sitemap.ts', description: 'Sitemap entries (merge into an existing sitemap)', content: fill(SITEMAP_SNIPPET) },
  ];
}
