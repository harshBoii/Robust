import { NextResponse } from 'next/server';

import { requireSuperadminSession } from '@/lib/auth/superadmin-session';
import { approveAccessRequest } from '@/lib/superadmin/access-requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ companyId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireSuperadminSession();
  if (auth.error) return auth.error;

  const { companyId } = await params;
  try {
    const result = await approveAccessRequest(companyId);
    return NextResponse.json({ success: true, company: result });
  } catch {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
}
