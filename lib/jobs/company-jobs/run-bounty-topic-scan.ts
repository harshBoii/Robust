import 'server-only';

import { scanBountyJob } from '@/lib/geo/bounty/scanBountyJob';

import type { JobRunResult } from './types';

/** Topic discovery via bounty microservice (`POST /company/bounty`). */
export async function runBountyTopicScanJob(companyId: string): Promise<JobRunResult> {
  try {
    const result = await scanBountyJob(companyId);
    return {
      status: 'SUCCESS',
      summary: {
        topicsDiscovered: result.topicsDiscovered,
        promptsDiscovered: result.promptsDiscovered,
      },
    };
  } catch (err) {
    return {
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
