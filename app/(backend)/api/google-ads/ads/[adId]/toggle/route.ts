import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { updateGoogleAdStatus } from '@/lib/google-ads/client';
import { googleAdsErrorFromUnknown } from '@/lib/google-ads/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ adId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { adId } = await params;

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true, customerId: true, loginCustomerId: true, refreshToken: true },
  });
  if (!integration?.customerId) return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });

  const ad = await prisma.googleAd.findFirst({
    where: { id: adId, googleAdsIntegrationId: integration.id },
    select: { id: true, googleAdId: true, status: true, adGroup: { select: { googleAdGroupId: true } } },
  });
  if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });

  const newStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  const adResourceName = `customers/${integration.customerId}/adGroupAds/${ad.adGroup.googleAdGroupId}~${ad.googleAdId}`;

  try {
    await updateGoogleAdStatus({
      refreshToken: integration.refreshToken,
      customerId: integration.customerId,
      loginCustomerId: integration.loginCustomerId,
      adResourceName,
      status: newStatus,
    });

    const updated = await prisma.googleAd.update({
      where: { id: adId },
      data: { status: newStatus },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ad: updated });
  } catch (err) {
    const { status, error } = googleAdsErrorFromUnknown(err);
    return NextResponse.json({ error }, { status });
  }
}
