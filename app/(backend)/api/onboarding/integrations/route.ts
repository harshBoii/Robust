import { NextResponse } from 'next/server';

import { requireOnboardingSession } from '@/lib/auth/onboarding-session';
import { getOnboardingSnapshot } from '@/lib/onboarding/snapshot';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  const snap = await getOnboardingSnapshot(session.companyId);
  if (!snap) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json({
    metaConnected: snap.integrations.metaConnected,
    shopifyConnected: snap.integrations.shopifyConnected,
    shopifyProductCount: snap.integrations.shopifyProductCount,
  });
}
