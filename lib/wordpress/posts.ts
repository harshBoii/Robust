import 'server-only';

import { wpFetch } from '@/lib/wordpress/client';
import type { WordPressContext } from '@/lib/wordpress/config';

/** Shape of the `/wp/v2/posts` response fields we rely on. */
export type WpPost = {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  guid?: { rendered?: string };
  title?: { rendered?: string };
  meta?: Record<string, unknown>;
};

export type WpPostInput = {
  title: string;
  content: string;
  slug?: string;
  excerpt?: string;
  status?: 'publish' | 'draft' | 'pending' | 'private' | 'future';
  /** ISO-8601 in UTC. WP interprets `date_gmt` unambiguously; `date` is site-local. */
  dateGmt?: string;
  categories?: number[];
  tags?: number[];
  author?: number;
  meta?: Record<string, unknown>;
};

function toRestBody(input: WpPostInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title,
    content: input.content,
    status: input.status ?? 'publish',
  };
  if (input.slug) body.slug = input.slug;
  if (input.excerpt) body.excerpt = input.excerpt;
  if (input.dateGmt) body.date_gmt = input.dateGmt;
  if (input.categories?.length) body.categories = input.categories;
  if (input.tags?.length) body.tags = input.tags;
  if (typeof input.author === 'number') body.author = input.author;
  if (input.meta && Object.keys(input.meta).length > 0) body.meta = input.meta;
  return body;
}

export async function createPost(
  ctx: WordPressContext,
  input: WpPostInput,
): Promise<WpPost> {
  return wpFetch<WpPost>(ctx, {
    method: 'POST',
    path: '/posts',
    body: toRestBody(input),
    retry: false,
  });
}

export async function updatePost(
  ctx: WordPressContext,
  postId: number,
  input: Partial<WpPostInput>,
): Promise<WpPost> {
  return wpFetch<WpPost>(ctx, {
    method: 'POST',
    path: `/posts/${postId}`,
    body: toRestBody(input as WpPostInput),
    retry: false,
  });
}

export async function getPost(
  ctx: WordPressContext,
  postId: number,
  opts?: { context?: 'view' | 'edit' },
): Promise<WpPost> {
  return wpFetch<WpPost>(ctx, {
    path: `/posts/${postId}`,
    query: { context: opts?.context ?? 'view' },
  });
}

/** Resolve the public permalink for a created post, falling back to the raw guid. */
export function postPermalink(post: WpPost): string | null {
  if (typeof post.link === 'string' && post.link) return post.link;
  if (typeof post.guid?.rendered === 'string' && post.guid.rendered) return post.guid.rendered;
  return null;
}
