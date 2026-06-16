import type { CompanyJobType, JobFrequency } from './types';
import { formatScheduleLabel } from './schedule';

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

/** Human-readable schedule in the job's configured timezone. */
export function scheduleDescriptionIST(
  frequency: JobFrequency,
  enabled: boolean,
  schedule?: import('./schedule').CompanyJobSchedule,
): string | null {
  if (schedule) return formatScheduleLabel(frequency, schedule, enabled);
  if (!enabled) return null;
  const time = '2:30 PM IST';
  switch (frequency) {
    case 'DAILY':
      return `Scheduled daily at ${time}`;
    case 'WEEKLY':
      return `Scheduled every Monday at ${time}`;
    case 'BIWEEKLY':
      return `Scheduled every other Monday at ${time}`;
    case 'MONTHLY':
      return `Scheduled on the 1st of each month at ${time}`;
    case 'CUSTOM':
      return null;
    default:
      return null;
  }
}

export function jobUseCaseDescription(jobType: CompanyJobType): string {
  switch (jobType) {
    case 'META_AUTO_ADS':
      return 'Starts new ad chats in auto mode with random ideas from your brand entity, then generates creatives and saves drafts or publishes to Meta.';
    case 'BOUNTY_PAGE_GENERATION':
      return 'Creates 2–5 bounty pages per run from random active prompts on the platforms you select.';
    case 'BOUNTY_TOPIC_SCAN':
      return 'Discovers new bounty topics and niches for your brand by scanning LLM radar opportunities.';
    case 'RADAR_PROMPT_REFRESH':
      return 'Refreshes home radar data and generates new search prompts for your existing topics.';
    default:
      return '';
  }
}
