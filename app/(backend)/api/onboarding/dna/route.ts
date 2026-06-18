import { NextResponse } from 'next/server';

import { requireOnboardingSession } from '@/lib/auth/onboarding-session';
import { generateAllBrandDna } from '@/lib/onboarding/generate-all-dna';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  const dna = await generateAllBrandDna(session.companyId);
  return NextResponse.json({ dna });
}
