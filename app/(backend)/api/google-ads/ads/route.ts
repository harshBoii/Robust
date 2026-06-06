import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ ads: [] });

  const ads = await prisma.googleAd.findMany({
    where: { googleAdsIntegrationId: integration.id },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    include: {
      creative: {
        select: { headlines: true, descriptions: true, adType: true, finalUrl: true },
      },
      adGroup: {
        select: { id: true, name: true, campaignId: true },
      },
    },
  });

  return NextResponse.json({ ads });
}
