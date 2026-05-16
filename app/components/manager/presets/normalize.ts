import type { ScheduleDuration } from '@/lib/meta/adset-schedule';
import {
  DEFAULT_BILLING_EVENT,
  DEFAULT_OPTIMIZATION_GOAL,
} from '@/lib/meta/adset-preset-meta';

import type { AdsetPreset, AnyObj, CampaignPreset, MetaCampaignOption } from './types';

const get = (o: unknown, k: string) => (o && typeof o === 'object' ? (o as AnyObj)[k] : undefined);

function normBigint(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return String(Math.floor(v));
  if (typeof v === 'string') return v;
  return String(v);
}

export function normalizeAdsetPreset(p: unknown): AdsetPreset {
  const pinned = get(p, 'pinnedCampaign');
  return {
    id: String(get(p, 'id') ?? ''),
    name: String(get(p, 'name') ?? ''),
    isDefault: Boolean(get(p, 'isDefault')),
    pinnedCampaignId:
      typeof get(p, 'pinnedCampaignId') === 'string' ? (get(p, 'pinnedCampaignId') as string) : null,
    pinnedCampaign:
      pinned && typeof pinned === 'object'
        ? {
            id: String(get(pinned, 'id') ?? ''),
            name: String(get(pinned, 'name') ?? ''),
            objective:
              typeof get(pinned, 'objective') === 'string' ? (get(pinned, 'objective') as string) : null,
          }
        : null,
    billingEvent:
      typeof get(p, 'billingEvent') === 'string' && get(p, 'billingEvent')
        ? (get(p, 'billingEvent') as string)
        : DEFAULT_BILLING_EVENT,
    optimizationGoal:
      typeof get(p, 'optimizationGoal') === 'string' && get(p, 'optimizationGoal')
        ? (get(p, 'optimizationGoal') as string)
        : DEFAULT_OPTIMIZATION_GOAL,
    dailyBudget: normBigint(get(p, 'dailyBudget')),
    lifetimeBudget: normBigint(get(p, 'lifetimeBudget')),
    scheduleDuration: (() => {
      const d = get(p, 'scheduleDuration');
      if (d === '3_days' || d === '1_week' || d === '1_month' || d === 'custom') return d;
      const legacyEnd = get(p, 'endTime');
      if (typeof legacyEnd === 'string' && legacyEnd) return 'custom' as ScheduleDuration;
      return null;
    })(),
    scheduleCustomEnd: (() => {
      const custom = get(p, 'scheduleCustomEnd');
      if (typeof custom === 'string' && custom) return custom;
      const legacyEnd = get(p, 'endTime');
      if (typeof legacyEnd === 'string' && legacyEnd) return legacyEnd;
      return null;
    })(),
    destinationType:
      typeof get(p, 'destinationType') === 'string' ? (get(p, 'destinationType') as string) : null,
    bidStrategy: typeof get(p, 'bidStrategy') === 'string' ? (get(p, 'bidStrategy') as string) : null,
    bidAmount: normBigint(get(p, 'bidAmount')),
    isDefaultCreative: Boolean(get(p, 'isDefaultCreative')),
    pacingType: typeof get(p, 'pacingType') === 'string' ? (get(p, 'pacingType') as string) : null,
    promotedObject:
      get(p, 'promotedObject') && typeof get(p, 'promotedObject') === 'object'
        ? (get(p, 'promotedObject') as AnyObj)
        : {},
    attributionSpec: Array.isArray(get(p, 'attributionSpec')) ? (get(p, 'attributionSpec') as unknown[]) : [],
    targeting:
      get(p, 'targeting') && typeof get(p, 'targeting') === 'object' ? (get(p, 'targeting') as AnyObj) : {},
    bidConstraints:
      get(p, 'bidConstraints') && typeof get(p, 'bidConstraints') === 'object'
        ? (get(p, 'bidConstraints') as AnyObj)
        : {},
  };
}

export function normalizeCampaignPreset(p: unknown): CampaignPreset {
  return {
    id: String(get(p, 'id') ?? ''),
    name: String(get(p, 'name') ?? ''),
    isDefault: Boolean(get(p, 'isDefault')),
    objective: typeof get(p, 'objective') === 'string' ? (get(p, 'objective') as string) : null,
    status: typeof get(p, 'status') === 'string' ? (get(p, 'status') as string) : null,
    spendCap: normBigint(get(p, 'spendCap')),
    dailyBudget: normBigint(get(p, 'dailyBudget')),
    lifetimeBudget: normBigint(get(p, 'lifetimeBudget')),
    bidStrategy: typeof get(p, 'bidStrategy') === 'string' ? (get(p, 'bidStrategy') as string) : null,
    specialAdCategories: Array.isArray(get(p, 'specialAdCategories'))
      ? ((get(p, 'specialAdCategories') as unknown[]).filter((x) => typeof x === 'string') as string[])
      : [],
  };
}

export function blankAdsetPreset(): AdsetPreset {
  return {
    id: '',
    name: '',
    isDefault: false,
    pinnedCampaignId: null,
    pinnedCampaign: null,
    dailyBudget: null,
    lifetimeBudget: null,
    scheduleDuration: '1_week',
    scheduleCustomEnd: null,
    billingEvent: DEFAULT_BILLING_EVENT,
    optimizationGoal: DEFAULT_OPTIMIZATION_GOAL,
    destinationType: null,
    bidStrategy: null,
    bidAmount: null,
    isDefaultCreative: false,
    pacingType: 'standard',
    promotedObject: { pixel_id: '', custom_event_type: 'PURCHASE' },
    attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
    targeting: {
      age_min: 25,
      age_max: 40,
      genders: [2],
      geo_locations: { countries: ['IN'] },
      device_platforms: ['mobile'],
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'story'],
      instagram_positions: ['stream', 'reels'],
      targeting_automation: { advantage_audience: 1 },
    },
    bidConstraints: {},
  };
}

export function blankCampaignPreset(): CampaignPreset {
  return {
    id: '',
    name: '',
    isDefault: false,
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    spendCap: null,
    dailyBudget: null,
    lifetimeBudget: null,
    bidStrategy: null,
    specialAdCategories: [],
  };
}
