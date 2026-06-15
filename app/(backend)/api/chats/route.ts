import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { createChatSession, listChatSessions } from '@/lib/chats/repository';
import { serializeMessage } from '@/lib/chats/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await listChatSessions(session.companyId);
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      currentStep: s.currentStep,
      updatedAt: s.updatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let title: string | undefined;
  let autoMode: boolean | undefined;
  try {
    const body = (await req.json()) as { title?: unknown; autoMode?: unknown };
    if (typeof body.title === 'string' && body.title.trim()) title = body.title.trim();
    if (typeof body.autoMode === 'boolean') autoMode = body.autoMode;
  } catch {
    // empty body ok
  }

  const created = await createChatSession({
    companyId: session.companyId,
    createdByUserId: session.userName,
    title,
    workflowState: autoMode === true ? { autoMode: true } : undefined,
  });

  return NextResponse.json({
    session: {
      id: created.id,
      title: created.title,
      status: created.status,
      currentStep: created.currentStep,
    },
    messages: (created.messages ?? []).map(serializeMessage),
  });
}
