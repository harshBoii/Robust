import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { updateAdStatus, type MetaAdStatus } from '@/lib/meta/client';

type Body = {
  status?: MetaAdStatus;
};

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ adId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { adId } = await ctx.params;
  if (!adId) {
    return NextResponse.json({ error: 'Missing adId' }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = body.status;
  if (status !== 'ACTIVE' && status !== 'PAUSED') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await updateAdStatus({ adId, status, companyId: session.companyId });

  return NextResponse.json({ ok: true });
}

