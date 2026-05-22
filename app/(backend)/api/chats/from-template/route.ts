import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { initTemplateSession } from '@/lib/templates/init-template-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let templateId: string | undefined;
  try {
    const body = (await req.json()) as { templateId?: unknown };
    if (typeof body.templateId === 'string' && body.templateId.trim()) {
      templateId = body.templateId.trim();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
  }

  try {
    const result = await initTemplateSession({
      companyId: session.companyId,
      createdByUserId: session.userName,
      templateId,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to start template';
    const status = message.startsWith('Unknown template') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
