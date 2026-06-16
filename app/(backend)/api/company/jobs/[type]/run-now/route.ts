import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { dispatchCompanyJob } from '@/lib/jobs/company-jobs';
import { isCompanyJobType } from '@/lib/jobs/company-jobs/validate-settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await context.params;
  if (!isCompanyJobType(type)) {
    return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
  }

  try {
    const result = await dispatchCompanyJob({
      companyId: session.companyId,
      jobType: type,
      source: 'manual',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[company/jobs/run-now]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Job failed' },
      { status: 500 },
    );
  }
}
