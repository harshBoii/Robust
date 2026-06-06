import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isGoogleAdsConfigured, requireGoogleAdsEnv } from '@/lib/google-ads/integration-token';
import { signGoogleAdsOAuthState } from '@/lib/auth/google-ads-oauth-state';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const GOOGLE_ADS_SCOPES = [
  'https://www.googleapis.com/auth/adwords',
].join(' ');

export async function GET(req: NextRequest) {
  if (!isGoogleAdsConfigured()) {
    return NextResponse.redirect(
      new URL('/profile/integration?gads_oauth=config', req.url),
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login?gads_oauth=session', req.url));
  }

  const env = requireGoogleAdsEnv();
  const state = await signGoogleAdsOAuthState(session.companyId);

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', GOOGLE_ADS_SCOPES);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(url);
}
