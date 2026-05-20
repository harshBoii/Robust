import 'server-only';

import { NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME } from '@/lib/auth/constants';
import { authCookieMaxAge, signSessionToken } from '@/lib/auth/jwt';
import { createAuthSession } from '@/lib/auth/session-store';

export async function establishSessionResponse(args: {
  companyId: string;
  userName: string;
  slug: string;
  userAgent: string | null;
  ipAddress: string | null;
  body?: Record<string, unknown>;
}): Promise<NextResponse> {
  const sessionId = crypto.randomUUID();
  const token = await signSessionToken({
    companyId: args.companyId,
    userName: args.userName,
    slug: args.slug,
    sessionId,
  });

  await createAuthSession({
    sessionId,
    companyId: args.companyId,
    userAgent: args.userAgent,
    ipAddress: args.ipAddress,
  });

  const res = NextResponse.json(args.body ?? { ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: authCookieMaxAge(),
  });
  return res;
}
