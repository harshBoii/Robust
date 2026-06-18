import { NextResponse } from 'next/server';

import { requireOnboardingSession } from '@/lib/auth/onboarding-session';
import { generateStartupPlan } from '@/lib/onboarding/generate-startup-plan';
import { getOnboardingSnapshot } from '@/lib/onboarding/snapshot';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  try {
    const plan = await generateStartupPlan(session.companyId);
    await prisma.company.update({
      where: { id: session.companyId },
      data: { onboardingPlan: plan },
    });
    const snap = await getOnboardingSnapshot(session.companyId);
    return NextResponse.json({ plan, company: snap });
  } catch (e) {
    console.error('[onboarding/plan]', e);
    const message = e instanceof Error ? e.message : 'Plan generation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
