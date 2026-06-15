/**
 * Meta deprecated legacy campaign objectives in favour of OUTCOME_* equivalents.
 * Any objective not starting with "OUTCOME_" is legacy and must be mapped before
 * calling the Ads API, otherwise you get:
 *   "Legacy objective is no longer available in ad creation."
 */

export type OutcomeObjective =
  | 'OUTCOME_SALES'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_APP_PROMOTION'
  | 'OUTCOME_AWARENESS';

const LEGACY_OBJECTIVE_MAP: Record<string, OutcomeObjective> = {
  // Traffic / clicks
  LINK_CLICKS: 'OUTCOME_TRAFFIC',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  // Conversions / sales
  CONVERSIONS: 'OUTCOME_SALES',
  PRODUCT_CATALOG_SALES: 'OUTCOME_SALES',
  CATALOG_SALES: 'OUTCOME_SALES',
  STORE_TRAFFIC: 'OUTCOME_SALES',
  // Leads
  LEAD_GENERATION: 'OUTCOME_LEADS',
  // App installs
  APP_INSTALLS: 'OUTCOME_APP_PROMOTION',
  // Awareness / reach
  BRAND_AWARENESS: 'OUTCOME_AWARENESS',
  REACH: 'OUTCOME_AWARENESS',
  LOCAL_AWARENESS: 'OUTCOME_AWARENESS',
  STORE_VISITS: 'OUTCOME_AWARENESS',
  // Engagement
  VIDEO_VIEWS: 'OUTCOME_ENGAGEMENT',
  PAGE_LIKES: 'OUTCOME_ENGAGEMENT',
  EVENT_RESPONSES: 'OUTCOME_ENGAGEMENT',
  MESSAGES: 'OUTCOME_ENGAGEMENT',
  POST_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
};

const VALID_OUTCOME_OBJECTIVES = new Set<string>([
  'OUTCOME_SALES',
  'OUTCOME_LEADS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_AWARENESS',
]);

/**
 * Normalise a campaign objective to its modern OUTCOME_* equivalent.
 * Returns the original value if it is already a valid OUTCOME_* objective.
 * Falls back to 'OUTCOME_TRAFFIC' when the value is unrecognised.
 */
export function normalizeObjective(objective: string | null | undefined): OutcomeObjective {
  if (!objective) return 'OUTCOME_TRAFFIC';
  const upper = objective.trim().toUpperCase();
  if (VALID_OUTCOME_OBJECTIVES.has(upper)) return upper as OutcomeObjective;
  return LEGACY_OBJECTIVE_MAP[upper] ?? 'OUTCOME_TRAFFIC';
}

export function isLegacyObjective(objective: string | null | undefined): boolean {
  if (!objective) return false;
  const upper = objective.trim().toUpperCase();
  return !VALID_OUTCOME_OBJECTIVES.has(upper);
}

/** Detect Meta's "legacy objective" error message. */
export function isLegacyObjectiveError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('legacy objective') || m.includes('simplified objective');
}
