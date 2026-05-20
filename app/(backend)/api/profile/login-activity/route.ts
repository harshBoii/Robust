import { NextResponse } from 'next/server';

import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const rows = await prisma.loginActivity.findMany({
    where: { companyId: session!.companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      success: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    activities: rows.map((r) => ({
      id: r.id,
      success: r.success,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
