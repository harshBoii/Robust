import { NextResponse } from 'next/server';

import { callCompanySeedMicroservice } from '@/lib/data-mine/microservice-client';
import { persistSeedResponse } from '@/lib/data-mine/persist-seed';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const company = await prisma.company.findUnique({
    where: { id: session!.companyId },
    select: { website: true, linkedinUrl: true },
  });

  if (!company) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const website = company.website?.trim();
  const linkedinUrl = company.linkedinUrl?.trim();

  if (!website || !linkedinUrl) {
    return NextResponse.json(
      {
        error: 'Website and LinkedIn URL are required before auto-fill. Save them in Data Mine first.',
      },
      { status: 400 },
    );
  }

  try {
    const response = await callCompanySeedMicroservice({
      websiteUrl: website,
      linkedinUrl,
      sessionId: `company-seed-${session!.companyId}`,
    });

    const snapshot = await persistSeedResponse(session!.companyId, response);
    return NextResponse.json({ dataMine: snapshot });
  } catch (e) {
    console.error('[company/seed]', e);
    const message = e instanceof Error ? e.message : 'Seed failed';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
