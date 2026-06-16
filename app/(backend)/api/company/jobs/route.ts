import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import {
  frequencyLabel,
  jobTypeLabel,
  listCompanyJobsWithRuns,
  parseJobSettings,
  updateCompanyJobConfig,
  upsertJobSchedule,
} from '@/lib/jobs/company-jobs';
import { isCompanyJobType, isJobFrequency } from '@/lib/jobs/company-jobs/validate-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobs = await listCompanyJobsWithRuns(session.companyId);
  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      label: jobTypeLabel(job.jobType),
      enabled: job.enabled,
      frequency: job.frequency,
      frequencyLabel: frequencyLabel(job.frequency),
      settings: job.settings,
      lastRunAt: job.lastRunAt?.toISOString() ?? null,
      nextRunAt: job.nextRunAt?.toISOString() ?? null,
      recentRuns: job.recentRuns.map((run) => ({
        id: run.id,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        summary: run.summary,
        error: run.error,
      })),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    jobType?: string;
    enabled?: boolean;
    frequency?: string;
    settings?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.jobType || !isCompanyJobType(body.jobType)) {
    return NextResponse.json({ error: 'Invalid jobType' }, { status: 400 });
  }

  if (body.frequency !== undefined && !isJobFrequency(body.frequency)) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
  }

  const existing = await listCompanyJobsWithRuns(session.companyId);
  const current = existing.find((j) => j.jobType === body.jobType);
  if (!current) {
    return NextResponse.json({ error: 'Job config not found' }, { status: 404 });
  }

  const enabled = typeof body.enabled === 'boolean' ? body.enabled : current.enabled;
  const frequency = body.frequency ?? current.frequency;
  const settings =
    body.settings !== undefined
      ? parseJobSettings(body.jobType, body.settings)
      : current.settings;

  let qstashScheduleId = current.qstashScheduleId;
  try {
    qstashScheduleId = await upsertJobSchedule({
      companyId: session.companyId,
      jobType: body.jobType,
      frequency,
      enabled,
      existingScheduleId: current.qstashScheduleId,
    });
  } catch (err) {
    console.warn('[company/jobs] QStash schedule sync failed', err);
  }

  const updated = await updateCompanyJobConfig(session.companyId, body.jobType, {
    enabled,
    frequency,
    settings,
    qstashScheduleId,
  });

  return NextResponse.json({
    job: {
      id: updated.id,
      jobType: updated.jobType,
      label: jobTypeLabel(updated.jobType),
      enabled: updated.enabled,
      frequency: updated.frequency,
      frequencyLabel: frequencyLabel(updated.frequency),
      settings: parseJobSettings(updated.jobType, updated.settings),
      lastRunAt: updated.lastRunAt?.toISOString() ?? null,
      nextRunAt: updated.nextRunAt?.toISOString() ?? null,
      qstashScheduleId: updated.qstashScheduleId,
    },
  });
}
