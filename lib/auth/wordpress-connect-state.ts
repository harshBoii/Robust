import { type NextRequest, type NextResponse } from 'next/server';

/**
 * CSRF state for the WordPress Application Password handshake.
 *
 * Mirrors the Shopify OAuth state cookie. The handshake is not OAuth — WP redirects back
 * with the credential in the query string — so this cookie is what proves the callback
 * belongs to a connect flow *we* started, for *this* company and *that* site.
 */

export const WORDPRESS_CONNECT_STATE_COOKIE = 'wordpress_connect_state';
const CONNECT_STATE_TTL_MS = 10 * 60 * 1000;

export type WordPressConnectStatePayload = {
  state: string;
  siteUrl: string;
  restBase: string;
  companyId: string;
  createdAt: number;
};

export function createWordPressConnectState(opts: {
  siteUrl: string;
  restBase: string;
  companyId: string;
}): WordPressConnectStatePayload {
  const state =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    state,
    siteUrl: opts.siteUrl,
    restBase: opts.restBase,
    companyId: opts.companyId,
    createdAt: Date.now(),
  };
}

export function setWordPressConnectStateCookie(
  response: NextResponse,
  payload: WordPressConnectStatePayload,
  isProduction: boolean,
) {
  response.cookies.set(WORDPRESS_CONNECT_STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(CONNECT_STATE_TTL_MS / 1000),
  });
}

export function readWordPressConnectState(
  request: NextRequest,
): WordPressConnectStatePayload | null {
  const raw = request.cookies.get(WORDPRESS_CONNECT_STATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WordPressConnectStatePayload;
    if (
      !parsed?.state ||
      !parsed?.siteUrl ||
      !parsed?.restBase ||
      !parsed?.companyId ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.createdAt > CONNECT_STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWordPressConnectStateOnResponse(response: NextResponse) {
  response.cookies.delete(WORDPRESS_CONNECT_STATE_COOKIE);
}
