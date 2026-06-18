import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME, SUPERADMIN_COOKIE_NAME } from './constants';
import { verifySessionToken } from './jwt';
import { revokeAuthSession } from './session-store';

/** Clears the session cookie, revokes the server session, and returns a small JSON body. */
export async function logoutJsonResponse(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    try {
      const payload = await verifySessionToken(token);
      const sessionId = payload.jti as string | undefined;
      if (sessionId) {
        await revokeAuthSession(sessionId);
      }
    } catch {
      // ignore invalid token on logout
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  res.cookies.delete(SUPERADMIN_COOKIE_NAME);
  return res;
}
