import { runBountyTopicScanJob } from '@/lib/jobs/company-jobs/run-bounty-topic-scan';

export async function runBountyJob(companyId: string) {
  const result = await runBountyTopicScanJob(companyId);
  if (result.status === 'FAILED') {
    throw new Error(result.error ?? 'Bounty topic scan failed');
  }
  return result.summary ?? {};
}
