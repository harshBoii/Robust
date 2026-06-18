import { NextResponse } from 'next/server';

import { rejectAccessRequest } from '@/lib/superadmin/access-requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ companyId: string }> };
type Body = { note?: string };

// v1: unprotected — add SUPERADMIN auth before production
export async function POST(req: Request, { params }: Params) {
  const { companyId } = await params;
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // optional body
  }

  try {
    const result = await rejectAccessRequest(companyId, body.note);
    return NextResponse.json({ success: true, company: result });
  } catch {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
}
