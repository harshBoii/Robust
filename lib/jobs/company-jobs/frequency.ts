import type { CompanyJobType, JobFrequency } from './types';

/** UTC cron expressions (09:00 UTC). */
export function cronForFrequency(frequency: JobFrequency): string | null {
  switch (frequency) {
    case 'DAILY':
      return '0 9 * * *';
    case 'WEEKLY':
      return '0 9 * * 1';
    case 'BIWEEKLY':
      return '0 9 * * 1';
    case 'MONTHLY':
      return '0 9 1 * *';
    case 'CUSTOM':
      return null;
    default:
      return '0 9 * * 1';
  }
}

export function shouldSkipBiweekly(lastRunAt: Date | null): boolean {
  if (!lastRunAt) return false;
  const days = (Date.now() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24);
  return days < 14;
}

export function shouldSkipForFrequency(
  frequency: JobFrequency,
  lastRunAt: Date | null,
): boolean {
  if (frequency === 'BIWEEKLY') return shouldSkipBiweekly(lastRunAt);
  return false;
}

export function jobTypeLabel(jobType: CompanyJobType): string {
  switch (jobType) {
    case 'META_AUTO_ADS':
      return 'Meta Auto Ads';
    case 'BOUNTY_PAGE_GENERATION':
      return 'Bounty Page Generation';
    case 'BOUNTY_TOPIC_SCAN':
      return 'Bounty Topic Scan';
    case 'RADAR_PROMPT_REFRESH':
      return 'Radar Prompt Refresh';
    default:
      return jobType;
  }
}

export function frequencyLabel(frequency: JobFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    case 'BIWEEKLY':
      return 'Every 2 weeks';
    case 'MONTHLY':
      return 'Monthly';
    case 'CUSTOM':
      return 'Custom';
    default:
      return frequency;
  }
}
