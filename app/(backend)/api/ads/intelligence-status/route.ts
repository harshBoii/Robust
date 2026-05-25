import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const assetIds = req.nextUrl.searchParams.get('assetIds')?.split(',').filter(Boolean) ?? [];
  if (!assetIds.length) {
    return NextResponse.json({ error: 'Missing assetIds' }, { status: 400 });
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, companyId: session.companyId },
    select: { id: true, intelligenceStatus: true },
  });

  const ready = assets.filter((a) => a.intelligenceStatus === 'READY').length;

  return NextResponse.json({
    total: assetIds.length,
    ready,
    assets: assets.map((a) => ({
      assetId: a.id,
      intelligenceStatus: a.intelligenceStatus,
    })),
  });
}
