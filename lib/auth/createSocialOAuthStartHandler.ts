import { type NextRequest, NextResponse } from "next/server";
import type { SocialProvider } from "@/app/generated/prisma/client";
import {
  getSocialOAuthEnv,
  isSocialOAuthConfigured,
  signSocialOAuthState,
} from "@/lib/auth/social-oauth-state";
import { getSession } from "@/lib/auth/session";

export function createSocialOAuthStartHandler(provider: SocialProvider) {
  return async function GET(req: NextRequest) {
    if (!isSocialOAuthConfigured(provider)) {
      return NextResponse.redirect(
        new URL(`/manager/social?oauth=${provider.toLowerCase()}&error=config`, req.url)
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL("/login?social_oauth=session", req.url));
    }

    const env = getSocialOAuthEnv(provider)!;
    const state = await signSocialOAuthState(session.companyId, provider);

    const url = new URL(env.authorizeUrl);
    url.searchParams.set("client_id", env.clientId);
    url.searchParams.set("redirect_uri", env.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", env.scopes);
    url.searchParams.set("response_type", "code");

    if (provider === "X") {
      url.searchParams.set("code_challenge", "challenge");
      url.searchParams.set("code_challenge_method", "plain");
    }

    if (provider === "REDDIT") {
      url.searchParams.set("duration", "permanent");
    }

    return NextResponse.redirect(url);
  };
}
