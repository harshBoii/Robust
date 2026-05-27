import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { buildRadarGetPayload } from '@/lib/geo/radar/buildRadarGetPayload';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const compareCompanyId = req.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  if (!compareCompanyId) {
    return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400 });
  }

  const requesterCompanyId = session.companyId;
  const allowed = await prisma.companyRival.findUnique({
    where: {
      companyId_rivalCompanyId: {
        companyId: requesterCompanyId,
        rivalCompanyId: compareCompanyId,
      },
    },
    select: { id: true },
  });

  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const payload = await buildRadarGetPayload(prisma, compareCompanyId);
  return NextResponse.json({ success: true, companyId: compareCompanyId, payload });
}
