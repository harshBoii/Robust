import type {
  BountySpreadPlatform,
  CompanyJobRunStatus,
  CompanyJobType,
  JobFrequency,
} from '@/app/generated/prisma/client';

export type { CompanyJobRunStatus, CompanyJobType, JobFrequency };

export type MetaAutoAdsJobSettings = {
  adsPerRun: number;
  publishMode: 'draft' | 'publish';
};

export type BountyPageGenerationSettings = {
  minPages: number;
  maxPages: number;
  platforms: BountySpreadPlatform[];
};

export type BountyTopicScanSettings = Record<string, never>;

export type RadarPromptRefreshSettings = Record<string, never>;

export type JobSettingsByType = {
  META_AUTO_ADS: MetaAutoAdsJobSettings;
  BOUNTY_PAGE_GENERATION: BountyPageGenerationSettings;
  BOUNTY_TOPIC_SCAN: BountyTopicScanSettings;
  RADAR_PROMPT_REFRESH: RadarPromptRefreshSettings;
};

export type CompanyJobConfigRow = {
  id: string;
  companyId: string;
  jobType: CompanyJobType;
  enabled: boolean;
  frequency: JobFrequency;
  settings: unknown;
  qstashScheduleId: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyJobRunRow = {
  id: string;
  configId: string;
  companyId: string;
  jobType: CompanyJobType;
  status: CompanyJobRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  summary: unknown;
  error: string | null;
};

export type JobRunResult = {
  status: CompanyJobRunStatus;
  summary?: Record<string, unknown>;
  error?: string;
};

export class MicroserviceGapError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Microservice jobs must be spaced at least 5 minutes apart. Retry in ${retryAfterSeconds}s.`);
    this.name = 'MicroserviceGapError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const MICROSERVICE_JOB_TYPES: CompanyJobType[] = [
  'RADAR_PROMPT_REFRESH',
  'BOUNTY_TOPIC_SCAN',
  'BOUNTY_PAGE_GENERATION',
];

export const ALL_JOB_TYPES: CompanyJobType[] = [
  'META_AUTO_ADS',
  'BOUNTY_PAGE_GENERATION',
  'BOUNTY_TOPIC_SCAN',
  'RADAR_PROMPT_REFRESH',
];
