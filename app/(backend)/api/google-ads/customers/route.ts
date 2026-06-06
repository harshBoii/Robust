import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { listAccessibleCustomers } from '@/lib/google-ads/client';
import { googleAdsErrorFromUnknown } from '@/lib/google-ads/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { refreshToken: true },
  });
  if (!integration) return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });

  try {
    const customers = await listAccessibleCustomers({ refreshToken: integration.refreshToken });
    return NextResponse.json({ customers });
  } catch (err) {
    const { status, error } = googleAdsErrorFromUnknown(err);
    return NextResponse.json({ error }, { status });
  }
}
