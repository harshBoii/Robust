import { DEFAULT_SPREAD_PLATFORMS } from '@/lib/geo/bounty/spread-platforms';

import type {
  BountyPageGenerationSettings,
  CompanyJobType,
  JobSettingsByType,
  JobFrequency,
  MetaAutoAdsJobSettings,
} from './types';
import { DEFAULT_JOB_SCHEDULE } from './schedule';

export { DEFAULT_JOB_SCHEDULE };

export const DEFAULT_FREQUENCY_BY_JOB: Record<CompanyJobType, JobFrequency> = {
  META_AUTO_ADS: 'WEEKLY',
  BOUNTY_PAGE_GENERATION: 'WEEKLY',
  BOUNTY_TOPIC_SCAN: 'MONTHLY',
  RADAR_PROMPT_REFRESH: 'BIWEEKLY',
};

export const DEFAULT_META_AUTO_ADS_SETTINGS: MetaAutoAdsJobSettings = {
  adsPerRun: 1,
  publishMode: 'draft',
};

export const DEFAULT_BOUNTY_PAGE_SETTINGS: BountyPageGenerationSettings = {
  minPages: 2,
  maxPages: 5,
  platforms: [...DEFAULT_SPREAD_PLATFORMS],
};

export const DEFAULT_JOB_SETTINGS: JobSettingsByType = {
  META_AUTO_ADS: DEFAULT_META_AUTO_ADS_SETTINGS,
  BOUNTY_PAGE_GENERATION: DEFAULT_BOUNTY_PAGE_SETTINGS,
  BOUNTY_TOPIC_SCAN: {},
  RADAR_PROMPT_REFRESH: {},
};

export function defaultSettingsForJob<T extends CompanyJobType>(
  jobType: T,
): JobSettingsByType[T] {
  return { ...DEFAULT_JOB_SETTINGS[jobType] } as JobSettingsByType[T];
}
