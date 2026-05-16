/** Meta Marketing API — valid placement values per publisher (v21). */
export const FACEBOOK_POSITION_OPTIONS = [
  'feed',
  'right_hand_column',
  'marketplace',
  'video_feeds',
  'story',
  'search',
  'instream_video',
  'profile_feed',
] as const;

export const INSTAGRAM_POSITION_OPTIONS = [
  'stream',
  'story',
  'explore',
  'explore_home',
  'reels',
  'profile_feed',
  'ig_search',
] as const;

export const AUDIENCE_NETWORK_POSITION_OPTIONS = ['classic', 'rewarded_video'] as const;

export const MESSENGER_POSITION_OPTIONS = [
  'messenger_home',
  'sponsored_messages',
  'story',
] as const;

const FACEBOOK_POSITION_SET = new Set<string>(FACEBOOK_POSITION_OPTIONS);
const INSTAGRAM_POSITION_SET = new Set<string>(INSTAGRAM_POSITION_OPTIONS);
const AUDIENCE_NETWORK_POSITION_SET = new Set<string>(AUDIENCE_NETWORK_POSITION_OPTIONS);
const MESSENGER_POSITION_SET = new Set<string>(MESSENGER_POSITION_OPTIONS);

/** Meta requires advantage_audience (0 or 1) inside targeting.targeting_automation. */
export const DEFAULT_ADVANTAGE_AUDIENCE = 1 as const;

export type AdvantageAudienceFlag = 0 | 1;

export const ADVANTAGE_AUDIENCE_OPTIONS = [
  { value: 1 as const, label: 'Enabled (1)', description: 'Advantage+ audience expansion on' },
  { value: 0 as const, label: 'Disabled (0)', description: 'Advantage+ audience expansion off' },
] as const;

export function normalizeAdvantageAudience(value: unknown): AdvantageAudienceFlag {
  if (value === 0 || value === '0' || value === false) return 0;
  if (value === 1 || value === '1' || value === true) return 1;
  return DEFAULT_ADVANTAGE_AUDIENCE;
}

export function sanitizeTargetingAutomation(raw: unknown): { advantage_audience: AdvantageAudienceFlag } {
  if (raw && typeof raw === 'object') {
    const src = raw as Record<string, unknown>;
    return { advantage_audience: normalizeAdvantageAudience(src.advantage_audience) };
  }
  return { advantage_audience: DEFAULT_ADVANTAGE_AUDIENCE };
}

export function getAdvantageAudienceFromTargeting(
  targeting: Record<string, unknown> | null | undefined,
): AdvantageAudienceFlag {
  if (!targeting || typeof targeting !== 'object') return DEFAULT_ADVANTAGE_AUDIENCE;
  const automation = targeting.targeting_automation;
  if (automation && typeof automation === 'object') {
    return normalizeAdvantageAudience((automation as Record<string, unknown>).advantage_audience);
  }
  return DEFAULT_ADVANTAGE_AUDIENCE;
}

export function withAdvantageAudience(
  targeting: Record<string, unknown>,
  advantageAudience: AdvantageAudienceFlag,
): Record<string, unknown> {
  return {
    ...targeting,
    targeting_automation: { advantage_audience: advantageAudience },
  };
}

type AudienceRef = { id: string; name?: string };
type InterestRef = { id: string; name?: string };

function filterPositions(values: unknown, allowed: Set<string>, migrate?: (p: string) => string | null): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const mapped = migrate ? migrate(raw) : raw;
    if (!mapped || !allowed.has(mapped)) continue;
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out;
}

/** `reels` is invalid on facebook_positions — use video_feeds for video surfaces. */
function migrateFacebookPosition(p: string): string | null {
  if (p === 'reels') return 'video_feeds';
  if (p === 'groups_feed' || p === 'profile_reels') return null;
  return p;
}

function sanitizeFacebookPositions(values: unknown): string[] {
  return filterPositions(values, FACEBOOK_POSITION_SET, migrateFacebookPosition);
}

function sanitizeInstagramPositions(values: unknown): string[] {
  return filterPositions(values, INSTAGRAM_POSITION_SET, (p) =>
    p === 'profile_reels' ? 'reels' : p,
  );
}

function isNonEmptyArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0;
}

function normalizeAudienceRefs(v: unknown): AudienceRef[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')
    .map((x) => {
      const o = x as { id: string; name?: string };
      return typeof o.name === 'string' && o.name.trim()
        ? { id: o.id, name: o.name }
        : { id: o.id };
    });
}

function normalizeInterests(v: unknown): InterestRef[] {
  return normalizeAudienceRefs(v) as InterestRef[];
}

function extractInterestsFromSource(src: Record<string, unknown>): InterestRef[] {
  if (Array.isArray(src.flexible_spec)) {
    for (const entry of src.flexible_spec) {
      if (entry && typeof entry === 'object') {
        const interests = normalizeInterests((entry as Record<string, unknown>).interests);
        if (interests.length) return interests;
      }
    }
  }
  if (src.detailed_targeting && typeof src.detailed_targeting === 'object') {
    return normalizeInterests((src.detailed_targeting as Record<string, unknown>).interests);
  }
  return [];
}

function extractExcludedAudiences(src: Record<string, unknown>): AudienceRef[] {
  if (src.exclusions && typeof src.exclusions === 'object') {
    const excluded = normalizeAudienceRefs(
      (src.exclusions as Record<string, unknown>).custom_audiences,
    );
    if (excluded.length) return excluded;
  }
  return normalizeAudienceRefs(src.excluded_custom_audiences);
}

/**
 * Normalize preset targeting to Meta Marketing API shape.
 * Drops invalid fields (detailed_targeting, excluded_custom_audiences) and empty arrays.
 */
export function sanitizeMetaTargeting(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (typeof src.age_min === 'number' && Number.isFinite(src.age_min)) {
    out.age_min = src.age_min;
  }
  if (typeof src.age_max === 'number' && Number.isFinite(src.age_max)) {
    out.age_max = src.age_max;
  }
  if (isNonEmptyArray(src.genders)) {
    out.genders = src.genders;
  }

  if (src.geo_locations && typeof src.geo_locations === 'object') {
    const geo = { ...(src.geo_locations as Record<string, unknown>) };
    if (Array.isArray(geo.countries)) {
      const countries = geo.countries.filter((c) => typeof c === 'string' && c.trim());
      if (countries.length) geo.countries = countries;
      else delete geo.countries;
    }
    if (Object.keys(geo).length > 0) out.geo_locations = geo;
  }

  if (isNonEmptyArray(src.device_platforms)) out.device_platforms = src.device_platforms;
  if (isNonEmptyArray(src.publisher_platforms)) out.publisher_platforms = src.publisher_platforms;
  if (isNonEmptyArray(src.locales)) out.locales = src.locales;

  const facebookPositions = sanitizeFacebookPositions(src.facebook_positions);
  if (facebookPositions.length) out.facebook_positions = facebookPositions;

  const instagramPositions = sanitizeInstagramPositions(src.instagram_positions);
  if (instagramPositions.length) out.instagram_positions = instagramPositions;

  const audienceNetworkPositions = filterPositions(
    src.audience_network_positions,
    AUDIENCE_NETWORK_POSITION_SET,
  );
  if (audienceNetworkPositions.length) {
    out.audience_network_positions = audienceNetworkPositions;
  }

  const messengerPositions = filterPositions(src.messenger_positions, MESSENGER_POSITION_SET);
  if (messengerPositions.length) out.messenger_positions = messengerPositions;

  const interests = extractInterestsFromSource(src);
  if (interests.length) {
    out.flexible_spec = [{ interests }];
  }

  const customAudiences = normalizeAudienceRefs(src.custom_audiences);
  if (customAudiences.length) {
    out.custom_audiences = customAudiences;
  }

  const excludedAudiences = extractExcludedAudiences(src);
  if (excludedAudiences.length) {
    out.exclusions = { custom_audiences: excludedAudiences };
  }

  out.targeting_automation = sanitizeTargetingAutomation(src.targeting_automation);

  return Object.keys(out).length > 0 ? out : { targeting_automation: out.targeting_automation };
}

/** UI helpers — read legacy or current targeting fields. */
export function getTargetingInterestsForEditor(targeting: Record<string, unknown>): InterestRef[] {
  return extractInterestsFromSource(targeting);
}

export function getTargetingExcludedAudiencesForEditor(
  targeting: Record<string, unknown>,
): AudienceRef[] {
  return extractExcludedAudiences(targeting);
}
