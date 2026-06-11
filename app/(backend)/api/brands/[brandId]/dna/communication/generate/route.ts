import { NextResponse } from 'next/server';

import { brandProfileFromEntity, dnaRouteConfig, requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';
import { generateCommunicationDna } from '@/lib/brand-dna/communication/generate';

export const dynamic = dnaRouteConfig.dynamic;
export const runtime = dnaRouteConfig.runtime;

type Params = { params: Promise<{ brandId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  try {
    const profile = brandProfileFromEntity(auth.brand!);
    const communicationDna = await generateCommunicationDna(profile);
    return NextResponse.json({ communicationDna });
  } catch (e) {
    console.error('[communication/generate]', e);
    return NextResponse.json({ error: 'Communication DNA generation failed' }, { status: 502 });
  }
}
