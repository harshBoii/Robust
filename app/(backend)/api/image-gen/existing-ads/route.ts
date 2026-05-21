import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ ads: [] });

  const creatives = await prisma.metaCreative.findMany({
    where: {
      metaIntegrationId: integration.id,
      OR: [{ thumbnailUrl: { not: null } }, { imageUrl: { not: null } }, { assetId: { not: null } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      headline: true,
      thumbnailUrl: true,
      imageUrl: true,
      assetId: true,
      asset: { select: { thumbnailUrl: true } },
    },
  });

  const ads = creatives
    .map((c) => {
      const thumbnailUrl =
        c.thumbnailUrl ?? c.imageUrl ?? c.asset?.thumbnailUrl ?? null;
      if (!thumbnailUrl) return null;
      return {
        id: c.id,
        name: c.headline?.slice(0, 80) || 'Ad creative',
        thumbnailUrl,
        assetId: c.assetId,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ ads });
}
