import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getChatSession } from '@/lib/chats/repository';
import { serializeSession } from '@/lib/chats/serialize';

export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const chat = await getChatSession(id, session.companyId);
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ session: serializeSession(chat) });
}
