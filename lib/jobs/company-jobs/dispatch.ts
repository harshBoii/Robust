import 'server-only';

import type { CompanyJobType } from '@/app/generated/prisma/client';

import { shouldSkipForFrequency } from './frequency';
import { executeCompanyJob } from './execute-job';
import {
  createCompanyJobRun,
  getCompanyJobConfig,
  updateCompanyJobConfig,
} from './repository';
import { parseJobSettings } from './validate-settings';
import type { JobRunResult } from './types';

export async function dispatchCompanyJob(input: {
  companyId: string;
  jobType: CompanyJobType;
  source: 'schedule' | 'manual';
}): Promise<JobRunResult> {
  const config = await getCompanyJobConfig(input.companyId, input.jobType);
  if (!config) {
    return { status: 'FAILED', error: 'Job config not found' };
  }

  if (input.source === 'schedule' && !config.enabled) {
    return { status: 'SKIPPED', error: 'Job is disabled' };
  }

  if (
    input.source === 'schedule' &&
    shouldSkipForFrequency(config.frequency, config.lastRunAt)
  ) {
    const run = await createCompanyJobRun({
      configId: config.id,
      companyId: input.companyId,
      jobType: input.jobType,
      status: 'SKIPPED',
      summary: { reason: 'biweekly_skip' },
    });
    return { status: 'SKIPPED', summary: { runId: run.id, reason: 'biweekly_skip' } };
  }

  const result = await executeCompanyJob(
    input.companyId,
    input.jobType,
    parseJobSettings(input.jobType, config.settings),
  );

  await createCompanyJobRun({
    configId: config.id,
    companyId: input.companyId,
    jobType: input.jobType,
    status: result.status,
    summary: result.summary,
    error: result.error,
  });

  await updateCompanyJobConfig(input.companyId, input.jobType, {
    lastRunAt: new Date(),
  });

  return result;
}
