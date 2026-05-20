import { NextResponse } from 'next/server';

import { disableTwoFactor } from '@/lib/auth/two-factor';
import { requireProfileSession } from '@/lib/profile/api-auth';

export const dynamic = 'force-dynamic';

type Body = { code?: string };

export async function POST(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
  }

  const ok = await disableTwoFactor(session!.companyId, code);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, twoFactorEnabled: false });
}
