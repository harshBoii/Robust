import { CTA_OPTIONS } from '@/lib/assistant/constants';

const PLACEHOLDER_TOKENS = new Set([
  'cta',
  'cta_type',
  'ctatype',
  'call_to_action',
  'n/a',
  'na',
  'tbd',
  'none',
  'url',
  'link',
  'website',
  'landing',
  'landingpage',
  'landing_page',
  'destination',
  'destination_url',
  'placeholder',
]);

const CTA_TYPE_VALUES = new Set(CTA_OPTIONS.map((v) => v.toLowerCase()));

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/** True when the value is a label/placeholder, not a real destination URL. */
export function isPlaceholderLandingUrl(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed) return true;
  const token = normalizeToken(trimmed);
  if (PLACEHOLDER_TOKENS.has(token)) return true;
  if (CTA_TYPE_VALUES.has(trimmed.toLowerCase())) return true;
  return false;
}

/** Meta requires http(s) URLs with a real hostname — rejects placeholders like "CTA" or "https://CTA". */
export function isValidMetaLandingUrl(raw: string | null | undefined): boolean {
  if (isPlaceholderLandingUrl(raw)) return false;
  const trimmed = raw!.trim();
  try {
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'cta' || host.length < 3) return false;
    if (!host.includes('.') && host !== 'localhost') return false;
    return true;
  } catch {
    return false;
  }
}

/** Normalize a validated landing URL to include https:// when omitted. */
export function normalizeMetaLandingUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Pick the first valid destination URL from candidates (brand website, offering URL, etc.).
 * Throws when none are usable so publish fails early with a clear message.
 */
export function resolveCreativeLandingUrl(
  candidates: Array<string | null | undefined>,
  options?: { fallback?: string },
): string {
  for (const candidate of candidates) {
    if (!isValidMetaLandingUrl(candidate)) continue;
    return normalizeMetaLandingUrl(candidate!);
  }

  const fallback = options?.fallback?.trim();
  if (fallback && isValidMetaLandingUrl(fallback)) {
    return normalizeMetaLandingUrl(fallback);
  }

  throw new Error(
    'A valid landing page URL is required (https://…). Update company website, offering URL, or creative landing URL — placeholders like "CTA" are not accepted.',
  );
}
