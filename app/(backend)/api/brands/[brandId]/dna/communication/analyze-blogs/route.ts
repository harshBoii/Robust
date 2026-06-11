import { NextResponse } from 'next/server';

import { analyzeBlogsForCommunicationDna } from '@/lib/brand-dna/communication/analyze-blogs';
import { dnaLongRouteConfig, requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';
import { analyzeBlogsSchema } from '@/lib/brand-dna/schemas';

export const dynamic = dnaLongRouteConfig.dynamic;
export const runtime = dnaLongRouteConfig.runtime;
export const maxDuration = dnaLongRouteConfig.maxDuration;

type Params = { params: Promise<{ brandId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = analyzeBlogsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide 1–20 valid blog URLs' }, { status: 400 });
  }

  try {
    const advanced = await analyzeBlogsForCommunicationDna(parsed.data.blogUrls);
    return NextResponse.json({ communicationDna: advanced });
  } catch (e) {
    console.error('[communication/analyze-blogs]', e);
    const message = e instanceof Error ? e.message : 'Blog analysis failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
