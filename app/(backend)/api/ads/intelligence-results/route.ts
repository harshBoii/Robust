import { NextRequest, NextResponse } from 'next/server';

import {
  getIntelligenceResultsForAssets,
  getLatestIntelligenceResults,
} from '@/lib/asset-intelligence/intelligence-results';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get('assetIds');
  const assetIds = raw?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];

  const results =
    assetIds.length > 0
      ? await getIntelligenceResultsForAssets(session.companyId, assetIds)
      : await getLatestIntelligenceResults(session.companyId);

  return NextResponse.json({ results });
}
