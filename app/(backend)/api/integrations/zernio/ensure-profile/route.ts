import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { ensureZernioProfile } from '@/lib/zernio/ensure-profile';
import { isZernioConfigured, zernioApiErrorMessage } from '@/lib/zernio/client';

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
    const zernioProfileId = await ensureZernioProfile(session.companyId);
    return NextResponse.json({ success: true, zernioProfileId });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: zernioApiErrorMessage(err) },
      { status: 500 },
    );
  }
}
