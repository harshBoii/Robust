import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      createdAt: true,
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { companyId: session.companyId, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

type PatchBody = { ids?: unknown; markRead?: unknown };

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? (body.ids.filter((x) => typeof x === 'string') as string[]) : [];
  const markRead = typeof body.markRead === 'boolean' ? body.markRead : true;

  if (!ids.length) return NextResponse.json({ error: 'Missing ids' }, { status: 400 });

  await prisma.notification.updateMany({
    where: { companyId: session.companyId, id: { in: ids } },
    data: markRead
      ? { isRead: true, readAt: new Date() }
      : { isRead: false, readAt: null },
  });

  return NextResponse.json({ ok: true });
}

