import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getAppOrigin } from '@/lib/app-origin';
import { parseBlogDestination } from '@/lib/geo/bounty/blog-destination';
import { buildNextjsClaudeCodePrompt } from '@/lib/nextjs/claude-code-prompt';
import { prisma } from '@/lib/prisma';
import {
  generateApiKey,
  generateRevalidateSecret,
  hashApiKey,
  normalizeBasePath,
} from '@/lib/nextjs/site';
import { encryptWpSecret, isWordPressCryptoConfigured } from '@/lib/wordpress/crypto';
import { normalizeSiteUrl } from '@/lib/wordpress/domain';

export const dynamic = 'force-dynamic';

const SITE_SELECT = {
  id: true,
  siteUrl: true,
  basePath: true,
  apiKeyPrefix: true,
  status: true,
  lastVerifiedAt: true,
  lastError: true,
  createdAt: true,
} as const;

async function requireCompanyId() {
  const session = await getSession();
  return session?.companyId ?? null;
}

function parseSite(body: Record<string, unknown>) {
  const url = normalizeSiteUrl(typeof body.siteUrl === 'string' ? body.siteUrl : '');
  if (!url.ok) return { ok: false as const, error: url.error };
  // The blog prefix is configured separately, so keep only the origin.
  const siteUrl = new URL(url.siteUrl).origin;
  const base = normalizeBasePath(body.basePath);
  if (!base.ok) return { ok: false as const, error: base.error };
  return { ok: true as const, siteUrl, basePath: base.basePath };
}

/** Connection status. Credentials are never returned here — only when (re)generated. */
export async function GET() {
  const companyId = await requireCompanyId();
  if (!companyId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [site, company, publishedCount] = await Promise.all([
    prisma.nextjsSite.findUnique({ where: { companyId }, select: SITE_SELECT }),
    prisma.company.findUnique({ where: { id: companyId }, select: { defaultBlogDestination: true } }),
    prisma.aeoPage.count({ where: { companyId, nextjsPublishedAt: { not: null } } }),
  ]);

  const connected = site?.status === 'connected';
  const apiBaseUrl = getAppOrigin();
  return NextResponse.json({
    connected,
    site: connected ? site : null,
    publishedCount,
    apiBaseUrl,
    defaultBlogDestination: parseBlogDestination(company?.defaultBlogDestination),
    // Secrets are only returned once (on POST), so this version carries placeholders.
    prompt:
      connected && site
        ? buildNextjsClaudeCodePrompt({ apiBaseUrl, siteUrl: site.siteUrl, basePath: site.basePath })
        : null,
  });
}

/**
 * Connect, or regenerate credentials for, the company's Next.js site. Returns the API key
 * and revalidate secret in plaintext exactly once; afterwards only a key prefix is shown.
 */
export async function POST(req: Request) {
  const companyId = await requireCompanyId();
  if (!companyId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isWordPressCryptoConfigured()) {
    return NextResponse.json(
      { error: 'Server is missing WORDPRESS_CREDENTIALS_SECRET, which is used to encrypt integration secrets.' },
      { status: 500 },
    );
  }

  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const parsed = parseSite(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const apiKey = generateApiKey();
  const revalidateSecret = generateRevalidateSecret();
  const data = {
    siteUrl: parsed.siteUrl,
    basePath: parsed.basePath,
    apiKeyHash: apiKey.hash,
    apiKeyPrefix: apiKey.prefix,
    revalidateSecretEnc: encryptWpSecret(revalidateSecret),
    status: 'connected',
    lastError: null,
  };

  // Upsert keeps the row id stable, so pages already published to this site stay live.
  const site = await prisma.nextjsSite.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
    select: SITE_SELECT,
  });

  const apiBaseUrl = getAppOrigin();
  return NextResponse.json({
    connected: true,
    site,
    apiBaseUrl,
    credentials: { apiKey: apiKey.key, revalidateSecret },
    prompt: buildNextjsClaudeCodePrompt({
      apiBaseUrl,
      siteUrl: site.siteUrl,
      basePath: site.basePath,
      apiKey: apiKey.key,
      revalidateSecret,
    }),
  });
}

/**
 * Update the site URL / blog path without rotating credentials, and/or toggle whether the
 * Next.js site is the default blog destination (`makeDefault: boolean`).
 */
export async function PATCH(req: Request) {
  const companyId = await requireCompanyId();
  if (!companyId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const existing = await prisma.nextjsSite.findUnique({ where: { companyId }, select: { status: true } });
  if (existing?.status !== 'connected') {
    return NextResponse.json({ error: 'Next.js site is not connected' }, { status: 404 });
  }

  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

  if (typeof body.makeDefault === 'boolean') {
    if (body.makeDefault) {
      await prisma.company.update({ where: { id: companyId }, data: { defaultBlogDestination: 'nextjs' } });
    } else {
      await prisma.company.updateMany({
        where: { id: companyId, defaultBlogDestination: 'nextjs' },
        data: { defaultBlogDestination: null },
      });
    }
    if (body.siteUrl === undefined) {
      return NextResponse.json({ ok: true, defaultBlogDestination: body.makeDefault ? 'nextjs' : null });
    }
  }

  const parsed = parseSite(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const site = await prisma.nextjsSite.update({
    where: { companyId },
    data: { siteUrl: parsed.siteUrl, basePath: parsed.basePath },
    select: SITE_SELECT,
  });
  return NextResponse.json({ connected: true, site });
}

/**
 * Disconnect: the API key stops working immediately (its hash is replaced with a random
 * value). The row is kept so reconnecting later preserves which pages were published.
 */
export async function DELETE() {
  const companyId = await requireCompanyId();
  if (!companyId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await prisma.nextjsSite.updateMany({
    where: { companyId },
    data: { status: 'disconnected', apiKeyHash: hashApiKey(generateApiKey().key) },
  });
  await prisma.company.updateMany({
    where: { id: companyId, defaultBlogDestination: 'nextjs' },
    data: { defaultBlogDestination: null },
  });
  return NextResponse.json({ connected: false });
}
