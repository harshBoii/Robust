import 'server-only';

import { runRadarJob } from '@/lib/jobs/run-radar';

import type { JobRunResult } from './types';

/** Topic discovery via full radar microservice (phase-1: same path as radar refresh). */
export async function runBountyTopicScanJob(companyId: string): Promise<JobRunResult> {
  try {
    const result = await runRadarJob(companyId);
    return {
      status: 'SUCCESS',
      summary: {
        topicsDiscovered: result.topics?.length ?? 0,
        promptsDiscovered: result.prompts?.length ?? 0,
      },
    };
  } catch (err) {
    return {
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
