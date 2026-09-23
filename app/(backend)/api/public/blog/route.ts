import { NextResponse } from 'next/server';

import { listPublishedPosts } from '@/lib/nextjs/page-payload';
import { authenticateNextjsApiKey } from '@/lib/nextjs/site';
import { NEXTJS_BLOG_API_VERSION, type BlogListResponse } from '@/lib/nextjs/types';

export const dynamic = 'force-dynamic';

/** Published posts for the Next.js site identified by the Bearer API key. */
export async function GET(req: Request) {
  const site = await authenticateNextjsApiKey(req);
  if (!site) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const body: BlogListResponse = {
    version: NEXTJS_BLOG_API_VERSION,
    posts: await listPublishedPosts(site),
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
