import { NextResponse } from 'next/server';

import { getTopWinningAssets, TopWinningError } from '@/lib/asset-intelligence/top-winning';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const assets = await getTopWinningAssets(session.companyId);
    return NextResponse.json({ assets });
  } catch (e) {
    if (e instanceof TopWinningError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[ads/top-winning]', e);
    return NextResponse.json({ error: 'Failed to fetch winning ads' }, { status: 500 });
  }
}
