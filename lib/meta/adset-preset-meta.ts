import {
  getRoasAverageFloor,
  isValueMinRoasBid,
  validateRoasAverageFloor,
} from '@/lib/meta/bid-constraints';
import { resolveAdsetScheduleTimes, type AdsetSchedulePresetFields } from '@/lib/meta/adset-schedule';
import { sanitizeMetaTargeting } from '@/lib/meta/targeting';

/** Meta Ad Set billing_event enum (Marketing API). */
export const BILLING_EVENT_OPTIONS = [
  { value: 'IMPRESSIONS', label: 'IMPRESSIONS', hint: 'Default for OUTCOME_SALES — charged per impression' },
  { value: 'LINK_CLICKS', label: 'LINK_CLICKS', hint: 'Traffic campaigns' },
  { value: 'APP_INSTALLS', label: 'APP_INSTALLS', hint: 'App promotion' },
  { value: 'PAGE_LIKES', label: 'PAGE_LIKES', hint: 'Page growth' },
  { value: 'POST_ENGAGEMENT', label: 'POST_ENGAGEMENT', hint: 'Engagement' },
  { value: 'THRUPLAY', label: 'THRUPLAY', hint: '15s+ or complete video views' },
  {
    value: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
    label: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
    hint: '2s continuous video views',
  },
] as const;

export type BillingEvent = (typeof BILLING_EVENT_OPTIONS)[number]['value'];

/** Meta Ad Set optimization_goal enum (subset used by Robust). */
export const OPTIMIZATION_GOAL_OPTIONS = [
  { value: 'OFFSITE_CONVERSIONS', label: 'OFFSITE_CONVERSIONS', hint: 'Recommended for OUTCOME_SALES', sales: true },
  { value: 'VALUE', label: 'VALUE', hint: 'ROAS — requires LOWEST_COST_WITH_MIN_ROAS + pixel', sales: true },
  { value: 'LINK_CLICKS', label: 'LINK_CLICKS', hint: 'Traffic / weak for pure sales', sales: true },
  { value: 'LANDING_PAGE_VIEWS', label: 'LANDING_PAGE_VIEWS', hint: 'Mid-funnel', sales: true },
  { value: 'IMPRESSIONS', label: 'IMPRESSIONS', hint: 'Awareness', sales: false },
  { value: 'REACH', label: 'REACH', hint: 'Awareness', sales: false },
  { value: 'APP_INSTALLS', label: 'APP_INSTALLS', hint: 'App campaigns', sales: false },
  { value: 'LEAD_GENERATION', label: 'LEAD_GENERATION', hint: 'Leads objective', sales: false },
  { value: 'QUALITY_LEAD', label: 'QUALITY_LEAD', hint: 'Leads objective', sales: false },
  { value: 'CONVERSATIONS', label: 'CONVERSATIONS', hint: 'Messaging', sales: false },
  { value: 'THRUPLAY', label: 'THRUPLAY', hint: 'Video', sales: false },
  { value: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', label: 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS', hint: 'Video', sales: false },
  { value: 'POST_ENGAGEMENT', label: 'POST_ENGAGEMENT', hint: 'Engagement', sales: false },
  { value: 'PAGE_LIKES', label: 'PAGE_LIKES', hint: 'Engagement', sales: false },
  { value: 'EVENT_RESPONSES', label: 'EVENT_RESPONSES', hint: 'Events', sales: false },
] as const;

export type OptimizationGoal = (typeof OPTIMIZATION_GOAL_OPTIONS)[number]['value'];

export const CUSTOM_EVENT_TYPE_OPTIONS = [
  'PURCHASE',
  'ADD_TO_CART',
  'LEAD',
  'COMPLETE_REGISTRATION',
  'VIEW_CONTENT',
  'SEARCH',
  'ADD_TO_WISHLIST',
  'INITIATED_CHECKOUT',
  'ADD_PAYMENT_INFO',
  'SUBSCRIBE',
  'START_TRIAL',
] as const;

export const DEFAULT_BILLING_EVENT: BillingEvent = 'IMPRESSIONS';
export const DEFAULT_OPTIMIZATION_GOAL: OptimizationGoal = 'OFFSITE_CONVERSIONS';

const BILLING_EVENT_SET = new Set<string>(BILLING_EVENT_OPTIONS.map((o) => o.value));
const OPTIMIZATION_GOAL_SET = new Set<string>(OPTIMIZATION_GOAL_OPTIONS.map((o) => o.value));

/** OUTCOME_SALES-compatible optimization goals. */
export const SALES_OPTIMIZATION_GOALS = OPTIMIZATION_GOAL_OPTIONS.filter((o) => o.sales).map((o) => o.value);

export function isBillingEvent(v: string): v is BillingEvent {
  return BILLING_EVENT_SET.has(v);
}

export function isOptimizationGoal(v: string): v is OptimizationGoal {
  return OPTIMIZATION_GOAL_SET.has(v);
}

export function isSalesCampaignObjective(objective: string | null | undefined): boolean {
  if (!objective) return true;
  return objective === 'OUTCOME_SALES' || objective.includes('SALES');
}

export function optimizationGoalsForCampaign(objective: string | null | undefined): OptimizationGoal[] {
  if (isSalesCampaignObjective(objective)) {
    return [...SALES_OPTIMIZATION_GOALS] as OptimizationGoal[];
  }
  return OPTIMIZATION_GOAL_OPTIONS.map((o) => o.value);
}

export function billingEventsForCampaign(objective: string | null | undefined): BillingEvent[] {
  if (isSalesCampaignObjective(objective)) {
    return ['IMPRESSIONS'];
  }
  return BILLING_EVENT_OPTIONS.map((o) => o.value);
}

const VALID_PACING_TYPES = ['standard', 'day_parting'] as const;

/** Meta expects pacing_type as a JSON array, e.g. `["standard"]`. */
export function toMetaPacingTypeParam(pacingType: string | null | undefined): string {
  const raw = pacingType?.trim() || 'standard';
  const v = (VALID_PACING_TYPES as readonly string[]).includes(raw) ? raw : 'standard';
  return JSON.stringify([v]);
}

export function toMetaUnixTimestamp(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(date.getTime())) return null;
  return String(Math.floor(date.getTime() / 1000));
}

export function normalizePromotedObject(po: unknown): Record<string, string> {
  if (!po || typeof po !== 'object') return {};
  const o = po as Record<string, unknown>;
  const out: Record<string, string> = {};
  if (typeof o.pixel_id === 'string' && o.pixel_id.trim()) out.pixel_id = o.pixel_id.trim();
  if (typeof o.custom_event_type === 'string' && o.custom_event_type.trim()) {
    out.custom_event_type = o.custom_event_type.trim();
  }
  return out;
}

export function optimizationGoalRequiresPixel(goal: string | null | undefined): boolean {
  return goal === 'OFFSITE_CONVERSIONS' || goal === 'VALUE';
}

export function coerceAdsetPresetMetaFields(body: {
  billingEvent?: unknown;
  optimizationGoal?: unknown;
  promotedObject?: unknown;
}): {
  billingEvent: BillingEvent;
  optimizationGoal: OptimizationGoal;
  promotedObject: Record<string, string>;
} {
  const billingRaw = typeof body.billingEvent === 'string' ? body.billingEvent.trim() : '';
  const optRaw = typeof body.optimizationGoal === 'string' ? body.optimizationGoal.trim() : '';
  const billingEvent = isBillingEvent(billingRaw) ? billingRaw : DEFAULT_BILLING_EVENT;
  const optimizationGoal = isOptimizationGoal(optRaw) ? optRaw : DEFAULT_OPTIMIZATION_GOAL;
  return {
    billingEvent,
    optimizationGoal,
    promotedObject: normalizePromotedObject(body.promotedObject),
  };
}

export function validateAdsetPresetMeta(input: {
  billingEvent: string;
  optimizationGoal: string;
  promotedObject: Record<string, string>;
  bidStrategy?: string | null;
  bidAmount?: string | number | bigint | null;
  bidConstraints?: unknown;
  campaignObjective?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!isBillingEvent(input.billingEvent)) {
    return { ok: false, error: `Invalid billing_event: ${input.billingEvent}` };
  }
  if (!isOptimizationGoal(input.optimizationGoal)) {
    return { ok: false, error: `Invalid optimization_goal: ${input.optimizationGoal}` };
  }

  const sales = isSalesCampaignObjective(input.campaignObjective);

  if (sales) {
    if (input.billingEvent !== 'IMPRESSIONS') {
      return {
        ok: false,
        error: 'OUTCOME_SALES campaigns require billing_event IMPRESSIONS',
      };
    }
    if (!(SALES_OPTIMIZATION_GOALS as readonly string[]).includes(input.optimizationGoal)) {
      return {
        ok: false,
        error: `${input.optimizationGoal} is not compatible with OUTCOME_SALES. Use OFFSITE_CONVERSIONS, VALUE, LINK_CLICKS, or LANDING_PAGE_VIEWS.`,
      };
    }
  }

  if (optimizationGoalRequiresPixel(input.optimizationGoal)) {
    if (!input.promotedObject.pixel_id) {
      return {
        ok: false,
        error: 'promoted_object.pixel_id is required for OFFSITE_CONVERSIONS and VALUE',
      };
    }
    if (!input.promotedObject.custom_event_type) {
      return {
        ok: false,
        error: 'promoted_object.custom_event_type is required (e.g. PURCHASE)',
      };
    }
    if (!CUSTOM_EVENT_TYPE_OPTIONS.includes(input.promotedObject.custom_event_type as (typeof CUSTOM_EVENT_TYPE_OPTIONS)[number])) {
      return {
        ok: false,
        error: `Invalid custom_event_type: ${input.promotedObject.custom_event_type}`,
      };
    }
  }

  if (input.optimizationGoal === 'VALUE') {
    if (input.bidStrategy !== 'LOWEST_COST_WITH_MIN_ROAS') {
      return {
        ok: false,
        error: 'optimization_goal VALUE requires bid_strategy LOWEST_COST_WITH_MIN_ROAS',
      };
    }
    const roasCheck = validateRoasAverageFloor(getRoasAverageFloor(input.bidConstraints));
    if (!roasCheck.ok) return roasCheck;
    if (input.bidAmount != null && String(input.bidAmount).trim() !== '') {
      return {
        ok: false,
        error: 'bid_amount is not used with VALUE + LOWEST_COST_WITH_MIN_ROAS — set roas_average_floor in bid_constraints instead',
      };
    }
  }

  if (
    input.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS' &&
    input.optimizationGoal !== 'VALUE'
  ) {
    return {
      ok: false,
      error: 'bid_strategy LOWEST_COST_WITH_MIN_ROAS requires optimization_goal VALUE',
    };
  }

  return { ok: true };
}

export type AdsetPresetRecord = AdsetSchedulePresetFields & {
  dailyBudget?: bigint | null;
  lifetimeBudget?: bigint | null;
  bidStrategy?: string | null;
  bidAmount?: bigint | null;
  bidConstraints?: unknown;
  billingEvent?: string | null;
  optimizationGoal?: string | null;
  destinationType?: string | null;
  pacingType?: string | null;
  promotedObject?: unknown;
  targeting?: unknown;
};

export function resolveOptimizationGoalForCreate(
  goal: string | null | undefined,
  campaignObjective: string | null | undefined,
): OptimizationGoal {
  let optimizationGoal = (goal?.trim() || DEFAULT_OPTIMIZATION_GOAL) as OptimizationGoal;
  if (!isOptimizationGoal(optimizationGoal)) {
    optimizationGoal = DEFAULT_OPTIMIZATION_GOAL;
  }
  if (isSalesCampaignObjective(campaignObjective) && optimizationGoal === 'LINK_CLICKS') {
    optimizationGoal = DEFAULT_OPTIMIZATION_GOAL;
  }
  return optimizationGoal;
}

function buildPromotedObjectForMeta(
  optimizationGoal: string,
  promotedObject: Record<string, string>,
): Record<string, string> | null {
  if (!optimizationGoalRequiresPixel(optimizationGoal)) {
    return Object.keys(promotedObject).length > 0 ? promotedObject : null;
  }
  if (!promotedObject.pixel_id) {
    throw new Error(
      'promoted_object.pixel_id is required for OFFSITE_CONVERSIONS and VALUE (set it in the ad set preset)',
    );
  }
  return {
    pixel_id: promotedObject.pixel_id,
    custom_event_type: promotedObject.custom_event_type || 'PURCHASE',
  };
}

export function buildCreateAdSetInputFromPreset(
  preset: AdsetPresetRecord,
  opts: {
    adAccountId: string;
    campaignId: string;
    name: string;
    status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    campaignObjective?: string | null;
    /** Resolved via resolvePromotedObjectForMeta (includes ad-account pixel fallback). */
    promotedObject?: Record<string, string> | null;
  },
) {
  const schedule = resolveAdsetScheduleTimes(preset);
  const billingEvent = preset.billingEvent?.trim() || DEFAULT_BILLING_EVENT;
  const optimizationGoal = resolveOptimizationGoalForCreate(
    preset.optimizationGoal,
    opts.campaignObjective,
  );
  const promotedObject =
    opts.promotedObject !== undefined
      ? opts.promotedObject
      : buildPromotedObjectForMeta(
          optimizationGoal,
          normalizePromotedObject(preset.promotedObject),
        );

  const valueMinRoas = isValueMinRoasBid(preset.bidStrategy, optimizationGoal);
  const bidConstraints =
    preset.bidConstraints && typeof preset.bidConstraints === 'object'
      ? (preset.bidConstraints as Record<string, unknown>)
      : null;

  return {
    adAccountId: opts.adAccountId,
    name: opts.name,
    campaignId: opts.campaignId,
    status: opts.status ?? ('PAUSED' as const),
    dailyBudget: preset.dailyBudget != null ? Number(preset.dailyBudget) : null,
    lifetimeBudget: preset.lifetimeBudget != null ? Number(preset.lifetimeBudget) : null,
    bidStrategy: preset.bidStrategy ?? null,
    bidAmount: valueMinRoas ? null : preset.bidAmount != null ? Number(preset.bidAmount) : null,
    bidConstraints: valueMinRoas ? bidConstraints : null,
    billingEvent,
    optimizationGoal,
    targeting: sanitizeMetaTargeting(preset.targeting),
    startTime: toMetaUnixTimestamp(schedule.startTime),
    endTime: toMetaUnixTimestamp(schedule.endTime),
    promotedObject,
    destinationType: preset.destinationType ?? null,
    pacingType: preset.pacingType,
  };
}
