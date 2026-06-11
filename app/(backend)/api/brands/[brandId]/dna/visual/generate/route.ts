import { NextResponse } from 'next/server';

import { analyzeVisualScreenshot } from '@/lib/brand-dna/visual/analyze-visual-screenshot';
import { mergeVisualDna } from '@/lib/brand-dna/visual/merge-visual-dna';
import { scrapeLandingPage } from '@/lib/brand-dna/visual/scrape-landing-page';
import { dnaLongRouteConfig, requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';
import { visualGenerateSchema } from '@/lib/brand-dna/schemas';

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

  const parsed = visualGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid landing page URL' }, { status: 400 });
  }

  try {
    const scraped = await scrapeLandingPage({
      landingPageUrl: parsed.data.landingPageUrl,
      companyId: auth.session.companyId,
      brandId,
    });

    const vision = await analyzeVisualScreenshot(scraped.screenshotBase64);
    const visualDna = mergeVisualDna(scraped.domPalette, vision);

    return NextResponse.json({
      visualDna,
      screenshotUrl: scraped.screenshotUrl,
    });
  } catch (e) {
    console.error('[visual/generate]', e);
    const message = e instanceof Error ? e.message : 'Visual DNA generation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
