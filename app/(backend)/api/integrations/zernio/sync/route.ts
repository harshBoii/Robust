import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { isZernioConfigured, zernioApiErrorMessage } from '@/lib/zernio/client';
import { syncZernioAccounts } from '@/lib/zernio/sync-accounts';

export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  if (!isZernioConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Zernio is not configured (ZERNIO_API_KEY missing)' },
      { status: 503 },
    );
  }

  try {
    await syncZernioAccounts(session.companyId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: zernioApiErrorMessage(err) },
      { status: 500 },
    );
  }
}
