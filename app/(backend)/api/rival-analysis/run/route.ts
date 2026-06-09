import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { scrapeRivalAds } from '@/lib/rival-analysis/scraper';
import { analyzeAds } from '@/lib/rival-analysis/analyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const StartRunSchema = z.object({
  companyRivalId: z.string().min(1),
});

// POST /api/rival-analysis/run
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = StartRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { companyRivalId } = parsed.data;

  // Verify ownership
  const rival = await prisma.companyRival.findFirst({
    where: { id: companyRivalId, companyId: session.companyId },
  });
  if (!rival) {
    return NextResponse.json({ error: 'Rival not found' }, { status: 404 });
  }

  // Create run record
  const run = await prisma.rivalScrapeRun.create({
    data: { companyRivalId, status: 'PENDING' },
  });

  // Fire scrape + analysis in background (does not block response)
  after(async () => {
    try {
      await prisma.rivalScrapeRun.update({
        where: { id: run.id },
        data: { status: 'PROCESSING' },
      });

      const scrapedAds = await scrapeRivalAds(rival.pageName, rival.country);

      if (!scrapedAds.length) {
        await prisma.rivalScrapeRun.update({
          where: { id: run.id },
          data: { status: 'FAILED', error: 'No ads found for this page name.' },
        });
        return;
      }

      const { perAdAnalysis, summary, imageVisible } = await analyzeAds(scrapedAds);

      // Persist ads
      await prisma.rivalAd.createMany({
        data: scrapedAds.map((ad, i) => ({
          scrapeRunId: run.id,
          libraryId: ad.library_id,
          startDate: ad.start_date ?? null,
          adStatus: ad.status,
          cta: ad.cta ?? null,
          adCopy: ad.ad_copy ?? null,
          rawText: ad.raw_text ?? null,
          daysRunning: ad.days_running ?? null,
          images: ad.images,
          videos: ad.videos as object[],
          landingUrls: ad.landing_urls,
          thumbnailUrl: ad.images[0] ?? null,
          analysis: perAdAnalysis[i] ?? null,
          imageVisible: imageVisible[i] ?? false,
          rank: i + 1,
        })),
      });

      // Persist intelligence summary
      await prisma.rivalIntelligenceSummary.create({
        data: { scrapeRunId: run.id, markdown: summary },
      });

      await prisma.rivalScrapeRun.update({
        where: { id: run.id },
        data: { status: 'DONE' },
      });
    } catch (err) {
      await prisma.rivalScrapeRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {});
    }
  });

  return NextResponse.json({ runId: run.id, status: 'PENDING' }, { status: 202 });
}
