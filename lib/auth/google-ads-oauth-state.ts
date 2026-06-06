import { SignJWT, jwtVerify } from 'jose';

const GADS_OAUTH_ISS = 'robust-gads-oauth';
const GADS_OAUTH_EXPIRY_SEC = 60 * 10;

function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET must be set in the environment (minimum 32 characters).');
  }
  return new TextEncoder().encode(raw);
}

export async function signGoogleAdsOAuthState(companyId: string): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({ purpose: 'gads_oauth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(companyId)
    .setIssuer(GADS_OAUTH_ISS)
    .setIssuedAt()
    .setExpirationTime(`${GADS_OAUTH_EXPIRY_SEC}s`)
    .sign(key);
}

export async function verifyGoogleAdsOAuthState(state: string): Promise<string | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(state, key, {
      issuer: GADS_OAUTH_ISS,
      algorithms: ['HS256'],
    });
    if (payload.purpose !== 'gads_oauth' || typeof payload.sub !== 'string') return null;
    return payload.sub;
  } catch {
    return null;
  }
}
