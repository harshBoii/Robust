import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';

export async function requireProfileSession() {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, error: null };
}
