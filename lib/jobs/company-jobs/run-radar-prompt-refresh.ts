import 'server-only';

import { runRadarJob } from '@/lib/jobs/run-radar';

import { assertMicroserviceGap, recordMicroserviceRun } from './microservice-gap';
import type { JobRunResult } from './types';

export async function runRadarPromptRefreshJob(companyId: string): Promise<JobRunResult> {
  await assertMicroserviceGap(companyId);
  try {
    const result = await runRadarJob(companyId);
    await recordMicroserviceRun(companyId);
    return {
      status: 'SUCCESS',
      summary: {
        topics: result.topics?.length ?? 0,
        prompts: result.prompts?.length ?? 0,
      },
    };
  } catch (err) {
    return {
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
