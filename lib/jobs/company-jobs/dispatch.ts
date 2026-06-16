import 'server-only';

import type { CompanyJobType } from '@/app/generated/prisma/client';

import { shouldSkipForFrequency } from './frequency';
import { MicroserviceGapError } from './types';
import { executeCompanyJob } from './execute-job';
import { enqueueDelayedJob } from './qstash';
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

  let result: JobRunResult;
  try {
    result = await executeCompanyJob(
      input.companyId,
      input.jobType,
      parseJobSettings(input.jobType, config.settings),
    );
  } catch (err) {
    if (err instanceof MicroserviceGapError && input.source === 'schedule') {
      await enqueueDelayedJob(
        { companyId: input.companyId, jobType: input.jobType },
        err.retryAfterSeconds,
      );
      const run = await createCompanyJobRun({
        configId: config.id,
        companyId: input.companyId,
        jobType: input.jobType,
        status: 'SKIPPED',
        summary: { reason: 'microservice_gap', retryAfterSeconds: err.retryAfterSeconds },
      });
      return {
        status: 'SKIPPED',
        summary: { runId: run.id, retryAfterSeconds: err.retryAfterSeconds },
      };
    }
    throw err;
  }

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
