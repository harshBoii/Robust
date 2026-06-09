import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { buildRadarGetPayload } from '@/lib/geo/radar/buildRadarGetPayload';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const rivalCompanyId = req.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  if (!rivalCompanyId) {
    return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400 });
  }

  const requesterCompanyId = session.companyId;

  const allowed = await prisma.companyRival.findFirst({
    where: { companyId: requesterCompanyId, rivalCompanyId },
    select: { id: true },
  });

  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const payload = await buildRadarGetPayload(prisma, rivalCompanyId);
  return NextResponse.json({ success: true, companyId: rivalCompanyId, payload });
}
