import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { requireGoogleAdsEnv } from '@/lib/google-ads/integration-token';
import { verifyGoogleAdsOAuthState } from '@/lib/auth/google-ads-oauth-state';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function redirect(req: NextRequest, pathname: string, query?: Record<string, string>) {
  const url = new URL(pathname, req.url);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oauthError = searchParams.get('error');

  if (oauthError) {
    console.error('[google-ads oauth callback] provider error:', oauthError);
    return redirect(req, '/profile/integration', { gads_oauth: 'error' });
  }

  const code = searchParams.get('code');
  if (!code) {
    return redirect(req, '/profile/integration', { gads_oauth: 'missing_code' });
  }

  let env: ReturnType<typeof requireGoogleAdsEnv>;
  try {
    env = requireGoogleAdsEnv();
  } catch {
    return redirect(req, '/profile/integration', { gads_oauth: 'config' });
  }

  const session = await getSession();
  if (!session) return redirect(req, '/login', { gads_oauth: 'session' });

  const stateParam = searchParams.get('state');
  if (stateParam) {
    const companyIdFromState = await verifyGoogleAdsOAuthState(stateParam);
    if (!companyIdFromState || companyIdFromState !== session.companyId) {
      return redirect(req, '/profile/integration', { gads_oauth: 'invalid_state' });
    }
  }

  const params = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  const tokenData = (await tokenRes.json()) as TokenResponse;

  if (tokenData.error || !tokenData.refresh_token) {
    console.error('[google-ads oauth callback] token exchange failed:', tokenData.error);
    return redirect(req, '/profile/integration', { gads_oauth: 'token_exchange' });
  }

  await prisma.googleAdsIntegration.upsert({
    where: { companyId: session.companyId },
    create: {
      companyId: session.companyId,
      refreshToken: tokenData.refresh_token,
    },
    update: {
      refreshToken: tokenData.refresh_token,
    },
  });

  return redirect(req, '/profile/integration', { gads_oauth: 'connected' });
}
