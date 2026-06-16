import 'server-only';

import { Client, Receiver } from '@upstash/qstash';

import type { CompanyJobType } from '@/app/generated/prisma/client';

import { cronForFrequency } from './frequency';
import { cronFromSchedule, type CompanyJobSchedule } from './schedule';

function getQstashToken(): string | null {
  return process.env.QSTASH_TOKEN?.trim() || null;
}

export function getJobsCallbackUrl(): string {
  const base =
    process.env.JOBS_CALLBACK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!base) {
    throw new Error('JOBS_CALLBACK_BASE_URL or VERCEL_URL must be set for QStash schedules');
  }
  const normalized = base.startsWith('http') ? base : `https://${base}`;
  return `${normalized.replace(/\/$/, '')}/api/internal/jobs/run`;
}

export function getQstashClient(): Client | null {
  const token = getQstashToken();
  if (!token) return null;
  return new Client({ token });
}

export function getQstashReceiver(): Receiver | null {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const next = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!current || !next) return null;
  return new Receiver({ currentSigningKey: current, nextSigningKey: next });
}

export type SchedulePayload = {
  companyId: string;
  jobType: CompanyJobType;
};

export async function upsertJobSchedule(input: {
  companyId: string;
  jobType: CompanyJobType;
  frequency: import('@/app/generated/prisma/client').JobFrequency;
  schedule: CompanyJobSchedule;
  enabled: boolean;
  existingScheduleId?: string | null;
}): Promise<string | null> {
  const client = getQstashClient();
  if (!client) return null;

  if (input.existingScheduleId) {
    try {
      await client.schedules.delete(input.existingScheduleId);
    } catch {
      // schedule may already be gone
    }
  }

  if (!input.enabled) return null;

  const cron = cronFromSchedule(input.frequency, input.schedule) ?? cronForFrequency(input.frequency);
  if (!cron) return null;

  const body: SchedulePayload = {
    companyId: input.companyId,
    jobType: input.jobType,
  };

  const schedule = await client.schedules.create({
    destination: getJobsCallbackUrl(),
    cron,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return schedule.scheduleId;
}

export async function deleteJobSchedule(scheduleId: string | null | undefined): Promise<void> {
  if (!scheduleId) return;
  const client = getQstashClient();
  if (!client) return;
  try {
    await client.schedules.delete(scheduleId);
  } catch {
    // ignore
  }
}

export async function enqueueDelayedJob(
  payload: SchedulePayload,
  delaySeconds: number,
): Promise<void> {
  const client = getQstashClient();
  if (!client) return;
  await client.publishJSON({
    url: getJobsCallbackUrl(),
    body: payload,
    delay: delaySeconds,
  });
}
