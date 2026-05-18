/** Shared enums for Miss Robusta preset / creative validation. */

export const CAMPAIGN_OBJECTIVE_OPTIONS = [
  'OUTCOME_SALES',
  'OUTCOME_LEADS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_AWARENESS',
] as const;

export const CAMPAIGN_STATUS_OPTIONS = ['ACTIVE', 'PAUSED'] as const;

export const BID_STRATEGY_OPTIONS = [
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
  'COST_CAP',
  'LOWEST_COST_WITH_MIN_ROAS',
] as const;

export const SPECIAL_AD_CATEGORY_OPTIONS = [
  'NONE',
  'CREDIT',
  'EMPLOYMENT',
  'HOUSING',
  'ISSUES_ELECTIONS_POLITICS',
  'FINANCIAL_PRODUCTS_SERVICES',
] as const;

export const SCHEDULE_DURATION_OPTIONS = ['3_days', '1_week', '1_month', 'custom'] as const;

export const DESTINATION_TYPE_OPTIONS = [
  'WEBSITE',
  'APP',
  'MESSENGER',
  'WHATSAPP',
  'ON_AD',
  'INSTAGRAM_PROFILE',
] as const;

export const PACING_TYPE_OPTIONS = ['standard', 'no_pacing'] as const;

export const CTA_OPTIONS = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'DOWNLOAD',
  'GET_QUOTE',
  'CONTACT_US',
  'BOOK_TRAVEL',
  'SUBSCRIBE',
] as const;

export const AD_TYPE_LABELS: Record<(typeof CAMPAIGN_OBJECTIVE_OPTIONS)[number], string> = {
  OUTCOME_SALES: 'Sales',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_APP_PROMOTION: 'App promotion',
  OUTCOME_AWARENESS: 'Awareness',
};
