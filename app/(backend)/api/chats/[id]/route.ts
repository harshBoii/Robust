import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getChatSession, updateChatSession } from '@/lib/chats/repository';
import { parseWorkflowState, serializeSession } from '@/lib/chats/serialize';

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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const chat = await getChatSession(id, session.companyId);
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { autoMode?: unknown };
  try {
    body = (await req.json()) as { autoMode?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.autoMode === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  if (typeof body.autoMode !== 'boolean') {
    return NextResponse.json({ error: 'autoMode must be a boolean' }, { status: 400 });
  }

  const workflowState = {
    ...parseWorkflowState(chat.workflowState),
    autoMode: body.autoMode,
  };

  await updateChatSession(id, session.companyId, { workflowState });
  const refreshed = await getChatSession(id, session.companyId);
  if (!refreshed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ session: serializeSession(refreshed) });
}
