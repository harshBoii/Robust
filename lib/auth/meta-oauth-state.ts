import { SignJWT, jwtVerify } from "jose";

const META_OAUTH_ISS = "robust-meta-oauth";
const META_OAUTH_EXPIRY_SEC = 60 * 10;

function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "JWT_SECRET must be set in the environment (minimum 32 characters).",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signMetaOAuthState(
  companyId: string,
  opts?: { returnTo?: 'onboarding' | 'integration' },
): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({
    purpose: "meta_oauth",
    returnTo: opts?.returnTo ?? "integration",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(companyId)
    .setIssuer(META_OAUTH_ISS)
    .setIssuedAt()
    .setExpirationTime(`${META_OAUTH_EXPIRY_SEC}s`)
    .sign(key);
}

export async function verifyMetaOAuthState(state: string): Promise<{
  companyId: string;
  returnTo: 'onboarding' | 'integration';
} | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(state, key, {
      issuer: META_OAUTH_ISS,
      algorithms: ["HS256"],
    });
    if (payload.purpose !== "meta_oauth" || typeof payload.sub !== "string") {
      return null;
    }
    const returnTo =
      payload.returnTo === "onboarding" ? "onboarding" : "integration";
    return { companyId: payload.sub, returnTo };
  } catch {
    return null;
  }
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_REDIRECT_URI?.trim(),
  );
}

export const META_OAUTH_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
].join(",");
