import 'server-only';

import type { CompanyJobType, Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';

import { DEFAULT_FREQUENCY_BY_JOB, DEFAULT_JOB_SCHEDULE, defaultSettingsForJob } from './defaults';
import { parseSchedule } from './schedule';
import { parseJobSettings } from './validate-settings';
import type { CompanyJobConfigRow, CompanyJobRunRow } from './types';
import { ALL_JOB_TYPES } from './types';

export async function ensureCompanyJobConfigs(companyId: string): Promise<CompanyJobConfigRow[]> {
  const existing = await prisma.companyJobConfig.findMany({
    where: { companyId },
  });

  const existingTypes = new Set(existing.map((r) => r.jobType));
  const missing = ALL_JOB_TYPES.filter((t) => !existingTypes.has(t));

  if (missing.length > 0) {
    await prisma.companyJobConfig.createMany({
      data: missing.map((jobType) => ({
        companyId,
        jobType,
        enabled: false,
        frequency: DEFAULT_FREQUENCY_BY_JOB[jobType],
        schedule: DEFAULT_JOB_SCHEDULE,
        settings: defaultSettingsForJob(jobType),
      })),
      skipDuplicates: true,
    });
  }

  return prisma.companyJobConfig.findMany({
    where: { companyId },
    orderBy: { jobType: 'asc' },
  });
}

export async function getCompanyJobConfig(
  companyId: string,
  jobType: CompanyJobType,
): Promise<CompanyJobConfigRow | null> {
  await ensureCompanyJobConfigs(companyId);
  return prisma.companyJobConfig.findUnique({
    where: { companyId_jobType: { companyId, jobType } },
  });
}

export async function listCompanyJobsWithRuns(companyId: string) {
  const configs = await ensureCompanyJobConfigs(companyId);
  const runs = await prisma.companyJobRun.findMany({
    where: { companyId },
    orderBy: { startedAt: 'desc' },
    take: 12,
  });

  const runsByType = new Map<CompanyJobType, CompanyJobRunRow[]>();
  for (const run of runs) {
    const list = runsByType.get(run.jobType) ?? [];
    if (list.length < 3) list.push(run);
    runsByType.set(run.jobType, list);
  }

  return configs.map((config) => ({
    ...config,
    schedule: parseSchedule(config.schedule),
    settings: parseJobSettings(config.jobType, config.settings),
    recentRuns: runsByType.get(config.jobType) ?? [],
  }));
}

export async function updateCompanyJobConfig(
  companyId: string,
  jobType: CompanyJobType,
  data: {
    enabled?: boolean;
    frequency?: import('@/app/generated/prisma/client').JobFrequency;
    schedule?: import('./schedule').CompanyJobSchedule;
    settings?: unknown;
    qstashScheduleId?: string | null;
    lastRunAt?: Date | null;
    nextRunAt?: Date | null;
  },
) {
  await ensureCompanyJobConfigs(companyId);
  return prisma.companyJobConfig.update({
    where: { companyId_jobType: { companyId, jobType } },
    data: {
      ...data,
      settings: data.settings as Prisma.InputJsonValue | undefined,
      schedule: data.schedule as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function createCompanyJobRun(input: {
  configId: string;
  companyId: string;
  jobType: CompanyJobType;
  status: import('@/app/generated/prisma/client').CompanyJobRunStatus;
  summary?: Record<string, unknown>;
  error?: string;
}) {
  return prisma.companyJobRun.create({
    data: {
      configId: input.configId,
      companyId: input.companyId,
      jobType: input.jobType,
      status: input.status,
      finishedAt: new Date(),
      summary: (input.summary ?? undefined) as Prisma.InputJsonValue | undefined,
      error: input.error ?? undefined,
    },
  });
}
