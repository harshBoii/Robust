import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { processPublishJobs } from '@/lib/meta/process-publish-jobs';

export const dynamic = 'force-dynamic';

function isWorkerAuthorized(req: NextRequest): boolean {
  const expected = process.env.WORKER_SECRET?.trim();
  if (!expected) return false;
  const got = req.headers.get('x-worker-secret') ?? '';
  return got === expected;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const cronAuthorized = isWorkerAuthorized(req);

  if (!session && !cronAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '10') || 10));

  try {
    const result = await processPublishJobs({
      limit,
      companyId: session?.companyId,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Publish worker failed' },
      { status: 500 },
    );
  }
}
