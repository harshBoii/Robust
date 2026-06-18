import { SignJWT, jwtVerify } from 'jose';

const SUPERADMIN_ISS = 'robust-superadmin';
const SUPERADMIN_TTL_SEC = 60 * 60 * 24;

function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      'JWT_SECRET must be set in the environment (minimum 32 characters).',
    );
  }
  return new TextEncoder().encode(raw);
}

export type SuperadminSession = {
  userName: string;
};

export async function signSuperadminToken(userName: string): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({ role: 'superadmin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userName)
    .setIssuer(SUPERADMIN_ISS)
    .setIssuedAt()
    .setExpirationTime(`${SUPERADMIN_TTL_SEC}s`)
    .sign(key);
}

export async function verifySuperadminToken(
  token: string,
): Promise<SuperadminSession | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: SUPERADMIN_ISS,
      algorithms: ['HS256'],
    });
    if (payload.role !== 'superadmin' || typeof payload.sub !== 'string') {
      return null;
    }
    return { userName: payload.sub };
  } catch {
    return null;
  }
}

export const SUPERADMIN_SESSION_TTL_SEC = SUPERADMIN_TTL_SEC;
