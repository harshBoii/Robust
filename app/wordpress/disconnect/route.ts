import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { wpFetch } from '@/lib/wordpress/client';
import { getWordPressContext } from '@/lib/wordpress/config';

export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const site = await prisma.wordPressSite.findFirst({
    where: { companyId: session.companyId, status: 'connected' },
    select: { id: true },
  });

  if (!site) {
    return NextResponse.json({ error: 'No connected WordPress site' }, { status: 404 });
  }

  // Best-effort revocation on the WP side so the credential stops working immediately.
  // A failure here must not block local disconnect — the user can always revoke from
  // their WP profile, and leaving the row "connected" would be worse.
  let revoked = false;
  try {
    const ctx = await getWordPressContext(session.companyId);
    if (ctx && ctx.siteId === site.id) {
      await wpFetch(ctx, {
        method: 'DELETE',
        path: '/users/me/application-passwords/introspect',
        retry: false,
      });
      revoked = true;
    }
  } catch {
    revoked = false;
  }

  await prisma.wordPressSite.update({
    where: { id: site.id },
    data: {
      status: 'disconnected',
      disconnectedAt: new Date(),
      // Overwrite the stored secret rather than leaving a revoked credential at rest.
      appPasswordEnc: '',
    },
  });

  return NextResponse.json({ success: true, revoked });
}
