import { NextResponse } from 'next/server';

import { approveAccessRequest } from '@/lib/superadmin/access-requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ companyId: string }> };

// v1: unprotected — add SUPERADMIN auth before production
export async function POST(_req: Request, { params }: Params) {
  const { companyId } = await params;
  try {
    const result = await approveAccessRequest(companyId);
    return NextResponse.json({ success: true, company: result });
  } catch {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
}
