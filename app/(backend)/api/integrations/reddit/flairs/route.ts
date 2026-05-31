import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { fetchRedditFlairs } from '@/lib/zernio/reddit-publish-targets';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const subreddit = request.nextUrl.searchParams.get('subreddit')?.trim();
  if (!subreddit) {
    return NextResponse.json({ success: false, error: 'subreddit is required' }, { status: 400 });
  }

  try {
    const flairs = await fetchRedditFlairs(session.companyId, subreddit);
    return NextResponse.json({ success: true, data: { flairs } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load flairs';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
