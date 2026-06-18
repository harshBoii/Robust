import { NextResponse } from 'next/server';

import { requireSuperadminSession } from '@/lib/auth/superadmin-session';
import { getSuperadminOverview } from '@/lib/superadmin/overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSuperadminSession();
  if (auth.error) return auth.error;

  const overview = await getSuperadminOverview();
  return NextResponse.json(overview);
}
