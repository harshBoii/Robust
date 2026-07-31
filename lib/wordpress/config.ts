import 'server-only';

import type { WordPressSite } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptWpSecret, isWordPressCryptoConfigured } from '@/lib/wordpress/crypto';
import { WordPressApiError } from '@/lib/wordpress/errors';

/** A connected site plus decrypted credentials, ready to hand to `wpFetch`. */
export type WordPressContext = {
  siteId: string;
  companyId: string;
  siteUrl: string;
  restBase: string;
  username: string;
  appPassword: string;
  site: WordPressSite;
};

export function getWordPressAppName(): string {
  return process.env.WORDPRESS_APP_NAME?.trim() || 'Immortel';
}

export function getWordPressAppId(): string | null {
  return process.env.WORDPRESS_APP_ID?.trim() || null;
}

export function getWordPressCallbackOrigin(): string | null {
  const raw = process.env.WORDPRESS_CALLBACK_ORIGIN?.trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

export function getWordPressProbeTtlMs(): number {
  const hours = Number.parseInt(process.env.WORDPRESS_PROBE_TTL_HOURS?.trim() ?? '', 10);
  return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
}

export function getWordPressPluginDownloadUrl(): string {
  return (
    process.env.WORDPRESS_PLUGIN_DOWNLOAD_URL?.trim() ||
    '/downloads/immortel-schema-bridge.zip'
  );
}

export function getWordPressFallbackAuthorId(): number | null {
  const raw = Number.parseInt(process.env.WORDPRESS_DEFAULT_AUTHOR_ID?.trim() ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** True when the server has everything needed to run the connect handshake. */
export function isWordPressConfigured(): boolean {
  return Boolean(isWordPressCryptoConfigured() && getWordPressCallbackOrigin());
}

/** The company's active WordPress site row, or null. */
export async function getWordPressSite(companyId: string): Promise<WordPressSite | null> {
  return prisma.wordPressSite.findFirst({
    where: { companyId, status: 'connected' },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Resolve credentials for a company. Returns null when no site is connected so callers
 * can treat "not connected" as a normal state; throws only when a connected row exists
 * but its stored secret cannot be decrypted (a real, actionable fault).
 */
export async function getWordPressContext(
  companyId: string,
): Promise<WordPressContext | null> {
  const site = await getWordPressSite(companyId);
  if (!site) return null;

  const appPassword = decryptWpSecret(site.appPasswordEnc);
  if (!appPassword) {
    throw new WordPressApiError('WP_UNAUTHORIZED', {
      message:
        'Stored WordPress credentials could not be decrypted — reconnect the site. ' +
        '(Has WORDPRESS_CREDENTIALS_SECRET changed?)',
    });
  }

  return {
    siteId: site.id,
    companyId,
    siteUrl: site.siteUrl,
    restBase: site.restBase,
    username: site.username,
    appPassword,
    site,
  };
}

/** Same as `getWordPressContext` but throws `WP_NOT_CONNECTED` instead of returning null. */
export async function requireWordPressContext(companyId: string): Promise<WordPressContext> {
  const ctx = await getWordPressContext(companyId);
  if (!ctx) throw new WordPressApiError('WP_NOT_CONNECTED');
  return ctx;
}
