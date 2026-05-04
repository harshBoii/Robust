import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_ISS = "robust";

export type SessionJwtPayload = JWTPayload & {
  userName?: string;
  slug?: string;
};

function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "JWT_SECRET must be set in the environment (minimum 32 characters).",
    );
  }
  return new TextEncoder().encode(raw);
}

function expirySeconds(): number {
  const n = Number(process.env.JWT_EXPIRES_SEC);
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 24 * 7;
}

export async function signSessionToken(args: {
  companyId: string;
  userName: string;
  slug: string;
}): Promise<string> {
  const key = getJwtSecretKey();
  const token = await new SignJWT({
    userName: args.userName,
    slug: args.slug,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.companyId)
    .setIssuer(JWT_ISS)
    .setIssuedAt()
    .setExpirationTime(`${expirySeconds()}s`)
    .sign(key);
  return token;
}

export async function verifySessionToken(
  token: string,
): Promise<SessionJwtPayload> {
  const key = getJwtSecretKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: JWT_ISS,
    algorithms: ["HS256"],
  });
  return payload as SessionJwtPayload;
}

export function authCookieMaxAge(): number {
  return expirySeconds();
}
