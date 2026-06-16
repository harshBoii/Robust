import 'server-only';

import type { CompanyJobType } from '@/app/generated/prisma/client';

import { runBountyPagesBatchJob } from './run-bounty-pages-batch';
import { runBountyTopicScanJob } from './run-bounty-topic-scan';
import { runMetaAutoAdsJob } from './run-meta-auto-ads';
import { runRadarPromptRefreshJob } from './run-radar-prompt-refresh';
import { parseJobSettings } from './validate-settings';
import type { JobRunResult } from './types';

export async function executeCompanyJob(
  companyId: string,
  jobType: CompanyJobType,
  settings: unknown,
): Promise<JobRunResult> {
  switch (jobType) {
    case 'RADAR_PROMPT_REFRESH':
      return runRadarPromptRefreshJob(companyId);
    case 'BOUNTY_TOPIC_SCAN':
      return runBountyTopicScanJob(companyId);
    case 'BOUNTY_PAGE_GENERATION':
      return runBountyPagesBatchJob(companyId, parseJobSettings(jobType, settings));
    case 'META_AUTO_ADS':
      return runMetaAutoAdsJob(companyId, parseJobSettings(jobType, settings));
    default:
      return { status: 'FAILED', error: `Unknown job type: ${jobType}` };
  }
}
