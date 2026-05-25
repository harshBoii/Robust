import { NextResponse } from 'next/server';

import {
  linkWinningAdCreatives,
  WinnersQueryError,
} from '@/lib/asset-intelligence/link-winning-creatives';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await linkWinningAdCreatives(session.companyId);
    const readyForAnalysis =
      result.linked + result.alreadyLinked + result.imported >= 1;

    return NextResponse.json({
      ...result,
      readyForAnalysis,
    });
  } catch (e) {
    if (e instanceof WinnersQueryError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[ads/link-winning-creatives]', e);
    return NextResponse.json(
      { error: 'Failed to link winning ad creatives' },
      { status: 500 },
    );
  }
}
