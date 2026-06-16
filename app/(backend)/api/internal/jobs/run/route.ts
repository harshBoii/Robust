import { NextRequest, NextResponse } from 'next/server';

import {
  dispatchCompanyJob,
  type SchedulePayload,
} from '@/lib/jobs/company-jobs';
import { getQstashReceiver } from '@/lib/jobs/company-jobs/qstash';
import { isCompanyJobType } from '@/lib/jobs/company-jobs/validate-settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const receiver = getQstashReceiver();
  const rawBody = await req.text();

  if (receiver) {
    const signature = req.headers.get('upstash-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    try {
      await receiver.verify({
        signature,
        body: rawBody,
        url: req.url,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'QStash receiver not configured' }, { status: 503 });
  }

  let body: SchedulePayload;
  try {
    body = JSON.parse(rawBody) as SchedulePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.companyId || !isCompanyJobType(body.jobType)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const result = await dispatchCompanyJob({
      companyId: body.companyId,
      jobType: body.jobType,
      source: 'schedule',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[internal/jobs/run]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Job failed' },
      { status: 500 },
    );
  }
}
