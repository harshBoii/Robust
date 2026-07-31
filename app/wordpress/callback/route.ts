import { NextResponse, type NextRequest } from 'next/server';

import { WordPressAuthType } from '@/app/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import {
  clearWordPressConnectStateOnResponse,
  readWordPressConnectState,
} from '@/lib/auth/wordpress-connect-state';
import { getWordPressCallbackOrigin, getWordPressContext } from '@/lib/wordpress/config';
import { encryptWpSecret } from '@/lib/wordpress/crypto';
import { probeAndPersist } from '@/lib/wordpress/capabilities';
import { normalizeSiteUrl } from '@/lib/wordpress/domain';

export const dynamic = 'force-dynamic';

const INTEGRATION_PAGE = '/profile/integration';

/**
 * WordPress hands the application password back as a **query parameter**. It must be
 * consumed and dropped immediately: we redirect (303) to a clean URL so it never lands in
 * browser history, and we never log the request URL on any path through this handler.
 */
function redirectClean(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL(`${origin}${INTEGRATION_PAGE}`);
  url.searchParams.set('modal', 'wordpress');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // 303 forces a GET and discards the original URL from the navigation entry.
  return NextResponse.redirect(url.toString(), 303);
}

export async function GET(req: NextRequest) {
  const appOrigin = getWordPressCallbackOrigin() ?? req.nextUrl.origin;
  const params = req.nextUrl.searchParams;

  const state = readWordPressConnectState(req);
  const returnedState = params.get('state');

  const finish = (result: Record<string, string>) => {
    const response = redirectClean(appOrigin, result);
    clearWordPressConnectStateOnResponse(response);
    return response;
  };

  if (!state || !returnedState || state.state !== returnedState) {
    return finish({ wordpress_error: 'state_mismatch' });
  }

  // The user can decline in wp-admin; WP then returns with `success=false`.
  if (params.get('success') === 'false') {
    return finish({ wordpress_error: 'declined' });
  }

  const username = params.get('user_login')?.trim();
  const password = params.get('password')?.trim();
  if (!username || !password) {
    return finish({ wordpress_error: 'missing_credentials' });
  }

  // WP echoes the site it issued the credential for; prefer it, but only if it still
  // normalizes to the site the flow started with — otherwise the callback was tampered with.
  const echoedSite = params.get('site_url');
  if (echoedSite) {
    const normalizedEcho = normalizeSiteUrl(echoedSite);
    if (normalizedEcho.ok && normalizedEcho.siteUrl !== state.siteUrl) {
      return finish({ wordpress_error: 'site_mismatch' });
    }
  }

  let siteId: string;
  try {
    const site = await prisma.wordPressSite.upsert({
      where: {
        companyId_siteUrl: { companyId: state.companyId, siteUrl: state.siteUrl },
      },
      create: {
        companyId: state.companyId,
        siteUrl: state.siteUrl,
        restBase: state.restBase,
        authType: WordPressAuthType.APP_PASSWORD,
        username,
        appPasswordEnc: encryptWpSecret(password),
        status: 'connected',
      },
      update: {
        restBase: state.restBase,
        authType: WordPressAuthType.APP_PASSWORD,
        username,
        appPasswordEnc: encryptWpSecret(password),
        status: 'connected',
        disconnectedAt: null,
        lastError: null,
      },
      select: { id: true },
    });
    siteId = site.id;
  } catch (e) {
    // Deliberately log only the error, never the request URL — it carries the password.
    console.error('[wordpress/callback] failed to persist site', e);
    return finish({ wordpress_error: 'persist_failed' });
  }

  // Detect JSON-LD capability immediately so the UI can prompt for the plugin right away.
  try {
    const ctx = await getWordPressContext(state.companyId);
    if (ctx && ctx.siteId === siteId) {
      const probe = await probeAndPersist(ctx);
      if (!probe.canPublishPosts) {
        return finish({ wordpress_connected: '1', wordpress_warning: 'cannot_publish' });
      }
      return finish({ wordpress_connected: '1', wordpress_schema: probe.jsonLdMode });
    }
  } catch (e) {
    console.error('[wordpress/callback] capability probe failed', e);
    return finish({ wordpress_connected: '1', wordpress_warning: 'probe_failed' });
  }

  return finish({ wordpress_connected: '1' });
}
