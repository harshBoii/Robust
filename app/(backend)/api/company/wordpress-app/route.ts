import { NextResponse, type NextRequest } from 'next/server';

import { WordPressAuthType } from '@/app/generated/prisma/enums';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { probeAndPersist } from '@/lib/wordpress/capabilities';
import {
  getWordPressContext,
  getWordPressPluginDownloadUrl,
  isWordPressConfigured,
} from '@/lib/wordpress/config';
import { encryptWpSecret } from '@/lib/wordpress/crypto';
import { discoverRestBase, normalizeSiteUrl } from '@/lib/wordpress/domain';
import { isWordPressApiError, wordPressErrorMessage } from '@/lib/wordpress/errors';
import { parseBlogDestination } from '@/lib/geo/bounty/blog-destination';

export const dynamic = 'force-dynamic';

type PatchBody = {
  siteUrl?: unknown;
  username?: unknown;
  appPassword?: unknown;
  defaultBlogDestination?: unknown;
};

/**
 * Serializable view of a connected site. The encrypted credential is never returned —
 * only whether one exists, mirroring the `hasApiSecret` discipline on the Shopify route.
 */
function serializeSite(site: {
  id: string;
  siteUrl: string;
  restBase: string;
  username: string;
  appPasswordEnc: string;
  authType: WordPressAuthType;
  status: string;
  wpVersion: string | null;
  jsonLdMode: string;
  pluginVersion: string | null;
  seoPlugin: string | null;
  capabilities: unknown;
  lastVerifiedAt: Date | null;
  lastError: string | null;
}) {
  return {
    id: site.id,
    siteUrl: site.siteUrl,
    restBase: site.restBase,
    username: site.username,
    hasAppPassword: Boolean(site.appPasswordEnc),
    authType: site.authType,
    status: site.status,
    wpVersion: site.wpVersion,
    jsonLdMode: site.jsonLdMode,
    pluginVersion: site.pluginVersion,
    seoPlugin: site.seoPlugin,
    capabilities: site.capabilities,
    lastVerifiedAt: site.lastVerifiedAt,
    lastError: site.lastError,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [site, company] = await Promise.all([
    prisma.wordPressSite.findFirst({
      where: { companyId: session.companyId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { defaultBlogDestination: true },
    }),
  ]);

  return NextResponse.json({
    site: site ? serializeSite(site) : null,
    connected: site?.status === 'connected',
    envConfigured: isWordPressConfigured(),
    pluginDownloadUrl: getWordPressPluginDownloadUrl(),
    defaultBlogDestination: parseBlogDestination(company?.defaultBlogDestination),
  });
}

/**
 * Manual credential entry — the documented fallback for sites where
 * `authorize-application.php` is blocked by a host or security plugin.
 * Also used to set the preferred blog destination.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyId = session.companyId;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Destination preference is independent of credentials.
  if (body.defaultBlogDestination !== undefined) {
    const destination =
      body.defaultBlogDestination === null
        ? null
        : parseBlogDestination(body.defaultBlogDestination);
    if (body.defaultBlogDestination !== null && !destination) {
      return NextResponse.json({ error: 'Invalid blog destination' }, { status: 400 });
    }
    await prisma.company.update({
      where: { id: companyId },
      data: { defaultBlogDestination: destination },
    });
    if (body.siteUrl === undefined) {
      return NextResponse.json({ success: true, defaultBlogDestination: destination });
    }
  }

  if (!isWordPressConfigured()) {
    return NextResponse.json(
      { error: 'WordPress publishing is not configured on the server' },
      { status: 500 },
    );
  }

  const siteUrlRaw = typeof body.siteUrl === 'string' ? body.siteUrl : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const appPassword = typeof body.appPassword === 'string' ? body.appPassword.trim() : '';

  if (!siteUrlRaw || !username || !appPassword) {
    return NextResponse.json(
      { error: 'Site URL, username and application password are all required' },
      { status: 400 },
    );
  }

  const normalized = normalizeSiteUrl(siteUrlRaw);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const restBase = await discoverRestBase(normalized.siteUrl);

  const site = await prisma.wordPressSite.upsert({
    where: { companyId_siteUrl: { companyId, siteUrl: normalized.siteUrl } },
    create: {
      companyId,
      siteUrl: normalized.siteUrl,
      restBase,
      authType: WordPressAuthType.MANUAL,
      username,
      appPasswordEnc: encryptWpSecret(appPassword),
      status: 'connected',
    },
    update: {
      restBase,
      authType: WordPressAuthType.MANUAL,
      username,
      appPasswordEnc: encryptWpSecret(appPassword),
      status: 'connected',
      disconnectedAt: null,
      lastError: null,
    },
  });

  // Verify immediately — bad credentials should fail here, not at publish time.
  try {
    const ctx = await getWordPressContext(companyId);
    if (ctx) await probeAndPersist(ctx);
  } catch (e) {
    const message = isWordPressApiError(e) ? wordPressErrorMessage(e) : 'Verification failed';
    return NextResponse.json(
      { error: message, site: serializeSite(site), connected: false },
      { status: isWordPressApiError(e) && e.code === 'WP_UNAUTHORIZED' ? 401 : 502 },
    );
  }

  const refreshed = await prisma.wordPressSite.findUnique({ where: { id: site.id } });
  return NextResponse.json({
    success: true,
    site: refreshed ? serializeSite(refreshed) : serializeSite(site),
    connected: true,
  });
}

/** Re-run capability detection on demand. */
export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ctx = await getWordPressContext(session.companyId);
    if (!ctx) {
      return NextResponse.json({ error: 'No connected WordPress site' }, { status: 404 });
    }
    const probe = await probeAndPersist(ctx);
    const refreshed = await prisma.wordPressSite.findUnique({ where: { id: ctx.siteId } });
    return NextResponse.json({
      success: true,
      probe: {
        jsonLdMode: probe.jsonLdMode,
        hasPlugin: probe.hasPlugin,
        seoPlugin: probe.seoPlugin,
        canPublishPosts: probe.canPublishPosts,
        canUnfilteredHtml: probe.canUnfilteredHtml,
      },
      site: refreshed ? serializeSite(refreshed) : null,
    });
  } catch (e) {
    const message = isWordPressApiError(e) ? wordPressErrorMessage(e) : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
