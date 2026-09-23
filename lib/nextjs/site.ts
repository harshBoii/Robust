import 'server-only';

import { createHash, randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import { decryptWpSecret } from '@/lib/wordpress/crypto';

/**
 * Custom Next.js site integration.
 *
 * The customer's site *pulls* published pages from /api/public/blog using a read API key,
 * and we *push* a revalidation ping to their site on publish so ISR picks up changes
 * immediately. We only ever store a hash of the API key; the revalidate secret is stored
 * encrypted because we have to send it.
 */

const API_KEY_PREFIX = 'rbk_live_';

export type NextjsSiteRow = {
  id: string;
  companyId: string;
  siteUrl: string;
  basePath: string;
  apiKeyPrefix: string;
  revalidateSecretEnc: string;
  status: string;
  lastVerifiedAt: Date | null;
  lastError: string | null;
};

const SITE_SELECT = {
  id: true,
  companyId: true,
  siteUrl: true,
  basePath: true,
  apiKeyPrefix: true,
  revalidateSecretEnc: true,
  status: true,
  lastVerifiedAt: true,
  lastError: true,
} as const;

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, API_KEY_PREFIX.length + 4) };
}

export function generateRevalidateSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** "/Blog/" → "/blog"; "" → "/blog". Only simple path segments are allowed. */
export function normalizeBasePath(raw: unknown): { ok: true; basePath: string } | { ok: false; error: string } {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { ok: true, basePath: '/blog' };
  const path = `/${value.replace(/^\/+|\/+$/g, '')}`.toLowerCase();
  if (!/^(\/[a-z0-9][a-z0-9-]*)+$/.test(path)) {
    return { ok: false, error: 'Blog path may only contain letters, numbers, dashes and slashes (e.g. /blog)' };
  }
  return { ok: true, basePath: path };
}

export function canonicalUrlFor(site: Pick<NextjsSiteRow, 'siteUrl' | 'basePath'>, slug: string): string {
  return `${site.siteUrl.replace(/\/+$/, '')}${site.basePath}/${encodeURIComponent(slug)}`;
}

export async function getConnectedNextjsSite(companyId: string): Promise<NextjsSiteRow | null> {
  return prisma.nextjsSite.findFirst({
    where: { companyId, status: 'connected' },
    select: SITE_SELECT,
  });
}

/** Resolve the site behind a `Authorization: Bearer rbk_live_…` header, or null. */
export async function authenticateNextjsApiKey(req: Request): Promise<NextjsSiteRow | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const key = match?.[1];
  if (!key || !key.startsWith(API_KEY_PREFIX)) return null;

  // Lookup is by SHA-256 of a 192-bit random key, so there is no useful timing signal.
  const site = await prisma.nextjsSite.findUnique({
    where: { apiKeyHash: hashApiKey(key) },
    select: SITE_SELECT,
  });
  return site && site.status === 'connected' ? site : null;
}

export function readRevalidateSecret(site: Pick<NextjsSiteRow, 'revalidateSecretEnc'>): string | null {
  return decryptWpSecret(site.revalidateSecretEnc);
}
