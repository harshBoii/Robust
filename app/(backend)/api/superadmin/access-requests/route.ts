import { NextResponse } from 'next/server';

import { requireSuperadminSession } from '@/lib/auth/superadmin-session';
import {
  listPendingAccessRequests,
  listRecentlyReviewedAccessRequests,
} from '@/lib/superadmin/access-requests';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSuperadminSession();
  if (auth.error) return auth.error;

  const [pending, reviewed] = await Promise.all([
    listPendingAccessRequests(),
    listRecentlyReviewedAccessRequests(),
  ]);
  return NextResponse.json({ pending, reviewed });
}
