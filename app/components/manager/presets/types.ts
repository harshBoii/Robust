import type { ScheduleDuration } from '@/lib/meta/adset-schedule';

export type MetaCampaignOption = {
  id: string;
  name: string;
  objective?: string | null;
  bidStrategy?: string | null;
};

export type AdsetPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  pinnedCampaignId: string | null;
  pinnedCampaign?: MetaCampaignOption | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  scheduleDuration: ScheduleDuration | null;
  scheduleCustomEnd: string | null;
  billingEvent: string | null;
  optimizationGoal: string | null;
  destinationType: string | null;
  bidStrategy: string | null;
  bidAmount: string | null;
  isDefaultCreative: boolean;
  pacingType: string | null;
  promotedObject: Record<string, unknown> | null;
  attributionSpec: unknown[] | null;
  targeting: Record<string, unknown> | null;
  bidConstraints: Record<string, unknown> | null;
};

export type CampaignPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  objective: string | null;
  status: string | null;
  spendCap: string | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  bidStrategy: string | null;
  specialAdCategories: string[] | null;
  /** Meta requires true/false when campaign has no daily/lifetime budget. null when using CBO. */
  isAdsetBudgetSharingEnabled: boolean | null;
};

export type AnyObj = Record<string, unknown>;
