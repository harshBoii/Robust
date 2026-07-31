/**
 * Shared topic → channel slug logic.
 *
 * Shopify creates one Blog per topic (handle) and WordPress one Category per topic (slug).
 * Both must derive the same slug from the same topic name, otherwise the two providers
 * drift apart and cross-provider republishing lands in mismatched channels.
 */

export const DEFAULT_TOPIC_SLUG = 'quick-reads';

/**
 * Slugify a topic name into a channel slug, or null when nothing usable remains.
 * `&` becomes `and` so "Skincare & Haircare" reads as `skincare-and-haircare`.
 */
export function slugifyTopicName(name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/\s+/)
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? slug : null;
}

/** Slugify with the shared fallback applied. */
export function topicChannelSlug(name: string | null | undefined): string {
  return slugifyTopicName(name ?? '') ?? DEFAULT_TOPIC_SLUG;
}

/** Human-readable channel title from a slug, matching the Shopify `blogCreate` title rule. */
export function channelTitleFromSlug(slug: string, originalName?: string | null): string {
  const trimmed = originalName?.trim();
  if (trimmed) return trimmed;
  if (slug === 'vlogs') return 'Vlogs';
  return slug;
}
