import { NextResponse } from 'next/server';

import { requireOnboardingSession } from '@/lib/auth/onboarding-session';
import { callCompanySeedMicroservice } from '@/lib/data-mine/microservice-client';
import { persistSeedResponse } from '@/lib/data-mine/persist-seed';
import { generateAllBrandDna } from '@/lib/onboarding/generate-all-dna';
import { getOnboardingSnapshot } from '@/lib/onboarding/snapshot';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { website: true, linkedinUrl: true },
  });

  if (!company?.website?.trim()) {
    return NextResponse.json({ error: 'Website is required for seeding' }, { status: 400 });
  }

  let seedOk = false;
  let seedError: string | null = null;

  try {
    const response = await callCompanySeedMicroservice({
      websiteUrl: company.website.trim(),
      linkedinUrl: company.linkedinUrl?.trim() || undefined,
      sessionId: `onboarding-seed-${session.companyId}`,
    });
    await persistSeedResponse(session.companyId, response);
    seedOk = true;
  } catch (e) {
    seedError = e instanceof Error ? e.message : 'Seed failed';
    console.error('[onboarding/seed]', e);
  }

  const dna = await generateAllBrandDna(session.companyId);
  const snap = await getOnboardingSnapshot(session.companyId);

  return NextResponse.json({
    seedOk,
    seedError,
    dna,
    company: snap,
  });
}
