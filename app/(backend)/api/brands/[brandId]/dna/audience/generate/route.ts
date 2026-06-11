import { NextResponse } from 'next/server';

import { generateAudienceDna } from '@/lib/brand-dna/audience/generate';
import { brandProfileFromEntity, requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ brandId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  try {
    const profile = brandProfileFromEntity(auth.brand!);
    const audienceDna = await generateAudienceDna(profile);
    return NextResponse.json({ audienceDna });
  } catch (e) {
    console.error('[audience/generate]', e);
    return NextResponse.json({ error: 'Audience DNA generation failed' }, { status: 502 });
  }
}
