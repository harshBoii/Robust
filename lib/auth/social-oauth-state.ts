import { SignJWT, jwtVerify } from "jose";
import type { SocialProvider } from "@/app/generated/prisma/client";

const SOCIAL_OAUTH_ISS = "robust-social-oauth";
const SOCIAL_OAUTH_EXPIRY_SEC = 60 * 10;

function getJwtSecretKey() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error("JWT_SECRET must be set in the environment (minimum 32 characters).");
  }
  return new TextEncoder().encode(raw);
}

export async function signSocialOAuthState(
  companyId: string,
  provider: SocialProvider
): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({ purpose: "social_oauth", provider })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(companyId)
    .setIssuer(SOCIAL_OAUTH_ISS)
    .setIssuedAt()
    .setExpirationTime(`${SOCIAL_OAUTH_EXPIRY_SEC}s`)
    .sign(key);
}

export async function verifySocialOAuthState(
  state: string
): Promise<{ companyId: string; provider: SocialProvider } | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(state, key, {
      issuer: SOCIAL_OAUTH_ISS,
      algorithms: ["HS256"],
    });
    if (
      payload.purpose !== "social_oauth" ||
      typeof payload.sub !== "string" ||
      typeof payload.provider !== "string"
    ) {
      return null;
    }
    const provider = payload.provider as SocialProvider;
    if (!["X", "LINKEDIN", "REDDIT"].includes(provider)) return null;
    return { companyId: payload.sub, provider };
  } catch {
    return null;
  }
}

export type SocialOAuthEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
};

export function getSocialOAuthEnv(provider: SocialProvider): SocialOAuthEnv | null {
  if (provider === "X") {
    const clientId = process.env.X_CLIENT_ID?.trim();
    const clientSecret = process.env.X_CLIENT_SECRET?.trim();
    const redirectUri = process.env.X_REDIRECT_URI?.trim();
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      authorizeUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scopes: "tweet.read tweet.write users.read offline.access",
    };
  }

  if (provider === "LINKEDIN") {
    const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
    if (!clientId || !clientSecret || !redirectUri) return null;
    return {
      clientId,
      clientSecret,
      redirectUri,
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      scopes: "openid profile w_member_social",
    };
  }

  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  const redirectUri = process.env.REDDIT_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: "identity submit read",
  };
}

export function isSocialOAuthConfigured(provider: SocialProvider): boolean {
  return getSocialOAuthEnv(provider) !== null;
}

export function socialProviderLabel(provider: SocialProvider): string {
  if (provider === "X") return "X";
  if (provider === "LINKEDIN") return "LinkedIn";
  return "Reddit";
}
