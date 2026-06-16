import { parseSpreadPlatforms } from '@/lib/geo/bounty/spread-platforms';

import {
  DEFAULT_BOUNTY_PAGE_SETTINGS,
  DEFAULT_META_AUTO_ADS_SETTINGS,
} from './defaults';
import type {
  BountyPageGenerationSettings,
  CompanyJobType,
  JobSettingsByType,
  MetaAutoAdsJobSettings,
} from './types';
import { ALL_JOB_TYPES } from './types';

function clampAdsPerRun(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_META_AUTO_ADS_SETTINGS.adsPerRun;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function parsePublishMode(value: unknown): 'draft' | 'publish' {
  return value === 'publish' ? 'publish' : 'draft';
}

export function parseMetaAutoAdsSettings(raw: unknown): MetaAutoAdsJobSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    adsPerRun: clampAdsPerRun(obj.adsPerRun),
    publishMode: parsePublishMode(obj.publishMode),
  };
}

export function parseBountyPageSettings(raw: unknown): BountyPageGenerationSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const minPages = Math.min(
    5,
    Math.max(2, Math.round(Number(obj.minPages) || DEFAULT_BOUNTY_PAGE_SETTINGS.minPages)),
  );
  const maxPages = Math.min(
    5,
    Math.max(minPages, Math.round(Number(obj.maxPages) || DEFAULT_BOUNTY_PAGE_SETTINGS.maxPages)),
  );
  const platforms = parseSpreadPlatforms(obj.platforms);
  return {
    minPages,
    maxPages,
    platforms: platforms.length > 0 ? platforms : [...DEFAULT_BOUNTY_PAGE_SETTINGS.platforms],
  };
}

export function parseJobSettings<T extends CompanyJobType>(
  jobType: T,
  raw: unknown,
): JobSettingsByType[T] {
  switch (jobType) {
    case 'META_AUTO_ADS':
      return parseMetaAutoAdsSettings(raw) as JobSettingsByType[T];
    case 'BOUNTY_PAGE_GENERATION':
      return parseBountyPageSettings(raw) as JobSettingsByType[T];
    case 'BOUNTY_TOPIC_SCAN':
    case 'RADAR_PROMPT_REFRESH':
      return {} as JobSettingsByType[T];
    default:
      return {} as JobSettingsByType[T];
  }
}

export function isCompanyJobType(value: string): value is CompanyJobType {
  return (ALL_JOB_TYPES as string[]).includes(value);
}

const VALID_FREQUENCIES = new Set(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']);

export function isJobFrequency(value: string): value is import('./types').JobFrequency {
  return VALID_FREQUENCIES.has(value);
}
