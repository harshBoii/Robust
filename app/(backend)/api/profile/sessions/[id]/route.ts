import { NextResponse } from 'next/server';

import { revokeAuthSession } from '@/lib/auth/session-store';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Session id required' }, { status: 400 });
  }

  if (id === session!.sessionId) {
    return NextResponse.json(
      { error: 'Cannot revoke your current session. Use log out instead.' },
      { status: 400 },
    );
  }

  const row = await prisma.authSession.findFirst({
    where: { id, companyId: session!.companyId, revokedAt: null },
    select: { id: true },
  });

  if (!row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  await revokeAuthSession(id);
  return NextResponse.json({ ok: true });
}
