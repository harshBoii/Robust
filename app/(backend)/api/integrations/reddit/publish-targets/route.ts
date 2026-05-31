import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { fetchRedditPublishTargets } from '@/lib/zernio/reddit-publish-targets';

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const data = await fetchRedditPublishTargets(session.companyId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load Reddit targets';
    const status = message.includes('not connected') ? 404 : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
