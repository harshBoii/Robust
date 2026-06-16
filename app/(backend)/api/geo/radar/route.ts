import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { buildRadarGetPayload } from '@/lib/geo/radar/buildRadarGetPayload';
import { runRadarPromptRefreshJob } from '@/lib/jobs/company-jobs/run-radar-prompt-refresh';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await runRadarPromptRefreshJob(session.companyId);
    if (result.status === 'FAILED') {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to refresh radar data' },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, ...result.summary });
  } catch (err) {
    console.error('Radar error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 502 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const companyId = session.companyId;
  const payload = await buildRadarGetPayload(prisma, companyId);

  return NextResponse.json({
    success: true,
    ...payload,
    metrics: payload.metrics.map((m: (typeof payload.metrics)[number]) => ({
      ...m,
      share_of_voice: m.shareOfVoice,
      top3_rate: m.top3Rate,
      query_coverage: m.queryCoverage,
      competitor_rank: m.competitorRank,
      topic_authority: m.topicAuthority,
    })),
    latest: payload.latest
      ? {
          ...payload.latest,
          share_of_voice: payload.latest.shareOfVoice,
          top3_rate: payload.latest.top3Rate,
          query_coverage: payload.latest.queryCoverage,
          competitor_rank: payload.latest.competitorRank,
          topic_authority: payload.latest.topicAuthority,
        }
      : null,
  });
}
