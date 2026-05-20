import 'server-only';

import { SignJWT, jwtVerify } from 'jose';

const PENDING_ISS = 'robust-2fa-pending';

function getKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET must be set (minimum 32 characters).');
  }
  return new TextEncoder().encode(raw);
}

export async function signPendingLoginToken(args: {
  companyId: string;
  userName: string;
  slug: string;
}): Promise<string> {
  const key = getKey();
  return new SignJWT({
    userName: args.userName,
    slug: args.slug,
    purpose: '2fa_pending',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(args.companyId)
    .setIssuer(PENDING_ISS)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

export async function verifyPendingLoginToken(token: string): Promise<{
  companyId: string;
  userName: string;
  slug: string;
}> {
  const key = getKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: PENDING_ISS,
    algorithms: ['HS256'],
  });
  if (payload.purpose !== '2fa_pending' || !payload.sub) {
    throw new Error('Invalid pending token');
  }
  return {
    companyId: payload.sub,
    userName: (payload.userName as string) ?? '',
    slug: (payload.slug as string) ?? '',
  };
}
