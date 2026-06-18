import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ONBOARDING_ISS = 'robust-onboarding';
const ONBOARDING_COOKIE = 'robust_onboarding';
const ONBOARDING_TTL_SEC = 60 * 60 * 24;

function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      'JWT_SECRET must be set in the environment (minimum 32 characters).',
    );
  }
  return new TextEncoder().encode(raw);
}

export type OnboardingSession = {
  companyId: string;
};

export async function signOnboardingToken(companyId: string): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({ purpose: 'onboarding' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(companyId)
    .setIssuer(ONBOARDING_ISS)
    .setIssuedAt()
    .setExpirationTime(`${ONBOARDING_TTL_SEC}s`)
    .sign(key);
}

export async function verifyOnboardingToken(
  token: string,
): Promise<OnboardingSession | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: ONBOARDING_ISS,
      algorithms: ['HS256'],
    });
    if (payload.purpose !== 'onboarding' || typeof payload.sub !== 'string') {
      return null;
    }
    return { companyId: payload.sub };
  } catch {
    return null;
  }
}

export async function getOnboardingSession(): Promise<OnboardingSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ONBOARDING_COOKIE)?.value;
  if (!token) return null;
  return verifyOnboardingToken(token);
}

export function setOnboardingCookie(response: NextResponse, token: string) {
  response.cookies.set(ONBOARDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONBOARDING_TTL_SEC,
  });
}

export function clearOnboardingCookie(response: NextResponse) {
  response.cookies.delete(ONBOARDING_COOKIE);
}

export async function requireOnboardingSession(): Promise<
  | { session: OnboardingSession; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getOnboardingSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Onboarding session required' }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function establishOnboardingResponse(
  companyId: string,
  body?: Record<string, unknown>,
): Promise<NextResponse> {
  const token = await signOnboardingToken(companyId);
  const res = NextResponse.json(body ?? { ok: true });
  setOnboardingCookie(res, token);
  return res;
}
