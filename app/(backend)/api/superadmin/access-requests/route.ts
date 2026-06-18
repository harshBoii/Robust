import { NextResponse } from 'next/server';

import {
  listPendingAccessRequests,
  listRecentlyReviewedAccessRequests,
} from '@/lib/superadmin/access-requests';

export const dynamic = 'force-dynamic';

// v1: unprotected — add SUPERADMIN auth before production
export async function GET() {
  const [pending, reviewed] = await Promise.all([
    listPendingAccessRequests(),
    listRecentlyReviewedAccessRequests(),
  ]);
  return NextResponse.json({ pending, reviewed });
}
