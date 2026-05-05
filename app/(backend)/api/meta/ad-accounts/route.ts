import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getMyAdAccounts } from '@/lib/meta/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adAccounts = await getMyAdAccounts();
    return NextResponse.json({ adAccounts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load ad accounts' },
      { status: 400 },
    );
  }
}

