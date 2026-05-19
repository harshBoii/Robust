import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { handleChatMessage } from '@/lib/chats/orchestrator';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  try {
    const result = await handleChatMessage(id, session.companyId, text);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[chats/messages]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
