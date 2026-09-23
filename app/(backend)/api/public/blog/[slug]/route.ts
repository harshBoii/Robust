import { NextResponse } from 'next/server';

import { getPublishedPost } from '@/lib/nextjs/page-payload';
import { authenticateNextjsApiKey } from '@/lib/nextjs/site';
import { NEXTJS_BLOG_API_VERSION, type BlogPostResponse } from '@/lib/nextjs/types';

export const dynamic = 'force-dynamic';

/** One published post (full content, FAQ and JSON-LD) for the site behind the API key. */
export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const site = await authenticateNextjsApiKey(req);
  if (!site) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const { slug } = await context.params;
  const post = await getPublishedPost(site, decodeURIComponent(slug));
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const body: BlogPostResponse = { version: NEXTJS_BLOG_API_VERSION, post };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
