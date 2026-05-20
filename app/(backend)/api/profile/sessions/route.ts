import { NextResponse } from 'next/server';

import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const now = new Date();
  const rows = await prisma.authSession.findMany({
    where: {
      companyId: session!.companyId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      isCurrent: r.id === session!.sessionId,
    })),
  });
}
