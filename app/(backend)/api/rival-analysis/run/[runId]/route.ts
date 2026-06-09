import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/rival-analysis/run/[runId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await params;

  const run = await prisma.rivalScrapeRun.findFirst({
    where: {
      id: runId,
      companyRival: { companyId: session.companyId },
    },
    include: {
      ads: { orderBy: { rank: 'asc' } },
      summary: { select: { markdown: true } },
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    error: run.error ?? null,
    ads: run.ads,
    summary: run.summary?.markdown ?? null,
  });
}
