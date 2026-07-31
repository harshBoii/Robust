import 'server-only';

import { WordPressJsonLdMode } from '@/app/generated/prisma/enums';
import type { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { wpFetch, wpProbeRoot } from '@/lib/wordpress/client';
import type { WordPressContext } from '@/lib/wordpress/config';
import { getWordPressFallbackAuthorId, getWordPressProbeTtlMs } from '@/lib/wordpress/config';
import { WordPressApiError } from '@/lib/wordpress/errors';

/**
 * Capability detection.
 *
 * WordPress, unlike Shopify, gives us no guaranteed place to put JSON-LD. What is possible
 * depends on the site: whether our companion plugin is installed, whether the connecting
 * user holds `unfiltered_html`, and whether an SEO plugin already owns the schema graph.
 * We resolve that once and cache it on the site row.
 */

export const IMMORTEL_NAMESPACE = 'immortel/v1';
export const META_JSON_LD = 'immortel_json_ld';
export const META_PAYLOAD = 'immortel_payload';

export type WpUserMe = {
  id: number;
  name?: string;
  slug?: string;
  capabilities?: Record<string, boolean>;
  extra_capabilities?: Record<string, boolean>;
};

export type ImmortelStatus = {
  version?: string;
  has_yoast?: boolean;
  has_rankmath?: boolean;
  can_unfiltered_html?: boolean;
};

export type ProbeResult = {
  wpVersion: string | null;
  namespaces: string[];
  hasPlugin: boolean;
  pluginVersion: string | null;
  seoPlugin: 'yoast' | 'rankmath' | null;
  canUnfilteredHtml: boolean;
  canPublishPosts: boolean;
  defaultAuthorId: number | null;
  jsonLdMode: WordPressJsonLdMode;
  username: string | null;
};

function detectSeoPlugin(namespaces: string[]): 'yoast' | 'rankmath' | null {
  if (namespaces.some((n) => n.startsWith('yoast/'))) return 'yoast';
  if (namespaces.some((n) => n.startsWith('rankmath/'))) return 'rankmath';
  return null;
}

/**
 * Pick the best available JSON-LD delivery mechanism.
 *
 * Order matters: the plugin is the only mechanism that puts schema in `<head>` and can
 * merge with an SEO plugin's graph, so it always wins. Inline `<script>` is the
 * zero-dependency fallback, but WP strips `<script>` via `wp_kses_post` for any user
 * without `unfiltered_html` — so we only claim it when the capability is actually present.
 */
export function resolveJsonLdMode(input: {
  hasPlugin: boolean;
  seoPlugin: 'yoast' | 'rankmath' | null;
  canUnfilteredHtml: boolean;
}): WordPressJsonLdMode {
  if (input.hasPlugin) return WordPressJsonLdMode.PLUGIN;
  if (input.canUnfilteredHtml) return WordPressJsonLdMode.INLINE;
  if (input.seoPlugin) return WordPressJsonLdMode.SEO_PLUGIN;
  return WordPressJsonLdMode.UNAVAILABLE;
}

/**
 * Interrogate a connected site. Safe to call repeatedly; each sub-probe degrades to a
 * conservative default rather than failing the whole call, because a site that can publish
 * posts but hides its user capabilities is still perfectly usable.
 */
export async function probeSite(ctx: WordPressContext): Promise<ProbeResult> {
  const root = await wpProbeRoot(ctx.restBase).catch(() => null);
  const namespaces = Array.isArray(root?.namespaces) ? root.namespaces : [];

  // `GET /wp/v2/users/me?context=edit` is the only reliable way to read capabilities.
  let me: WpUserMe | null = null;
  try {
    me = await wpFetch<WpUserMe>(ctx, {
      path: '/users/me',
      query: { context: 'edit' },
    });
  } catch (e) {
    // 401 here is fatal — the credentials are wrong, not merely limited.
    if (e instanceof WordPressApiError && e.code === 'WP_UNAUTHORIZED') throw e;
  }

  const caps = { ...(me?.capabilities ?? {}), ...(me?.extra_capabilities ?? {}) };
  const canPublishPosts = caps.publish_posts === true || caps.administrator === true;
  let canUnfilteredHtml = caps.unfiltered_html === true;

  // Our plugin reports capabilities directly; it is authoritative over the users/me
  // reading because it evaluates `current_user_can` server-side at request time.
  let hasPlugin = namespaces.includes(IMMORTEL_NAMESPACE);
  let pluginVersion: string | null = null;
  let statusSeo: 'yoast' | 'rankmath' | null = null;

  if (hasPlugin) {
    try {
      const status = await wpFetch<ImmortelStatus>(ctx, {
        namespace: IMMORTEL_NAMESPACE,
        path: '/status',
      });
      pluginVersion = typeof status.version === 'string' ? status.version : null;
      if (typeof status.can_unfiltered_html === 'boolean') {
        canUnfilteredHtml = status.can_unfiltered_html;
      }
      if (status.has_yoast) statusSeo = 'yoast';
      else if (status.has_rankmath) statusSeo = 'rankmath';
    } catch {
      // Namespace advertised but endpoint unreachable — treat the plugin as absent so we
      // fall back to a mechanism we can actually verify.
      hasPlugin = false;
    }
  }

  const seoPlugin = statusSeo ?? detectSeoPlugin(namespaces);

  return {
    wpVersion: null,
    namespaces,
    hasPlugin,
    pluginVersion,
    seoPlugin,
    canUnfilteredHtml,
    canPublishPosts,
    defaultAuthorId: me?.id ?? getWordPressFallbackAuthorId(),
    jsonLdMode: resolveJsonLdMode({ hasPlugin, seoPlugin, canUnfilteredHtml }),
    username: me?.slug ?? null,
  };
}

/** Probe and persist onto the `WordPressSite` row. */
export async function probeAndPersist(ctx: WordPressContext): Promise<ProbeResult> {
  try {
    const probe = await probeSite(ctx);
    await prisma.wordPressSite.update({
      where: { id: ctx.siteId },
      data: {
        jsonLdMode: probe.jsonLdMode,
        pluginVersion: probe.pluginVersion,
        seoPlugin: probe.seoPlugin,
        defaultAuthorId: probe.defaultAuthorId,
        wpVersion: probe.wpVersion,
        capabilities: {
          hasPlugin: probe.hasPlugin,
          canUnfilteredHtml: probe.canUnfilteredHtml,
          canPublishPosts: probe.canPublishPosts,
          namespaces: probe.namespaces,
        } satisfies Prisma.InputJsonValue,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });
    return probe;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.wordPressSite
      .update({
        where: { id: ctx.siteId },
        data: { lastError: message.slice(0, 1000), lastVerifiedAt: new Date() },
      })
      .catch(() => undefined);
    throw e;
  }
}

/** Re-probe only when the cached result has aged past WORDPRESS_PROBE_TTL_HOURS. */
export async function ensureFreshProbe(ctx: WordPressContext): Promise<void> {
  const last = ctx.site.lastVerifiedAt?.getTime() ?? 0;
  if (Date.now() - last < getWordPressProbeTtlMs()) return;
  // A stale probe must never block publishing — worst case we act on the cached mode.
  await probeAndPersist(ctx).catch(() => undefined);
}
