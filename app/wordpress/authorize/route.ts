import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/lib/auth/session';
import {
  createWordPressConnectState,
  setWordPressConnectStateCookie,
} from '@/lib/auth/wordpress-connect-state';
import {
  getWordPressAppId,
  getWordPressAppName,
  getWordPressCallbackOrigin,
} from '@/lib/wordpress/config';
import { isWordPressCryptoConfigured } from '@/lib/wordpress/crypto';
import { discoverRestBase, normalizeSiteUrl } from '@/lib/wordpress/domain';
import { wpProbeRoot } from '@/lib/wordpress/client';

export const dynamic = 'force-dynamic';

const INTEGRATION_PAGE = '/profile/integration';

function fail(origin: string, code: string): NextResponse {
  return NextResponse.redirect(
    `${origin}${INTEGRATION_PAGE}?modal=wordpress&wordpress_error=${encodeURIComponent(code)}`,
  );
}

/**
 * Start the WordPress Application Password handshake.
 *
 * Redirects the admin to their own `wp-admin/authorize-application.php`, which — on
 * approval — sends them back to our callback with a freshly minted application password.
 * We never see or ask for their account password.
 */
export async function GET(req: NextRequest) {
  const appOrigin = getWordPressCallbackOrigin() ?? req.nextUrl.origin;

  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.redirect(`${appOrigin}/login`);
  }

  if (!isWordPressCryptoConfigured()) {
    return fail(appOrigin, 'server_not_configured');
  }
  if (!getWordPressCallbackOrigin()) {
    return fail(appOrigin, 'callback_origin_missing');
  }

  const rawSite = req.nextUrl.searchParams.get('site') ?? '';
  const normalized = normalizeSiteUrl(rawSite);
  if (!normalized.ok) {
    return fail(appOrigin, 'invalid_site_url');
  }

  // Confirm the site actually speaks WordPress REST before bouncing the user to wp-admin,
  // so a typo surfaces here rather than as a confusing 404 on their own domain.
  const restBase = await discoverRestBase(normalized.siteUrl);
  try {
    await wpProbeRoot(restBase);
  } catch {
    return fail(appOrigin, 'rest_unreachable');
  }

  const payload = createWordPressConnectState({
    siteUrl: normalized.siteUrl,
    restBase,
    companyId: session.companyId,
  });

  const successUrl = new URL(`${appOrigin}/wordpress/callback`);
  successUrl.searchParams.set('state', payload.state);

  const authorizeUrl = new URL(`${normalized.siteUrl}/wp-admin/authorize-application.php`);
  authorizeUrl.searchParams.set('app_name', getWordPressAppName());
  const appId = getWordPressAppId();
  if (appId) authorizeUrl.searchParams.set('app_id', appId);
  authorizeUrl.searchParams.set('success_url', successUrl.toString());

  const response = NextResponse.redirect(authorizeUrl.toString());
  setWordPressConnectStateCookie(response, payload, process.env.NODE_ENV === 'production');
  return response;
}
