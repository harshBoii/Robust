import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SUPERADMIN_COOKIE_NAME } from '@/lib/auth/constants';
import {
  SUPERADMIN_SESSION_TTL_SEC,
  signSuperadminToken,
  verifySuperadminToken,
  type SuperadminSession,
} from '@/lib/auth/superadmin-token';

export type { SuperadminSession };

export async function getSuperadminSession(): Promise<SuperadminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPERADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySuperadminToken(token);
}

export function setSuperadminCookie(response: NextResponse, token: string) {
  response.cookies.set(SUPERADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SUPERADMIN_SESSION_TTL_SEC,
  });
}

export function clearSuperadminCookie(response: NextResponse) {
  response.cookies.delete(SUPERADMIN_COOKIE_NAME);
}

export async function requireSuperadminSession(): Promise<
  | { session: SuperadminSession; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getSuperadminSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Superadmin session required' }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function establishSuperadminResponse(
  userName: string,
  body?: Record<string, unknown>,
): Promise<NextResponse> {
  const token = await signSuperadminToken(userName);
  const res = NextResponse.json(body ?? { ok: true });
  setSuperadminCookie(res, token);
  return res;
}
