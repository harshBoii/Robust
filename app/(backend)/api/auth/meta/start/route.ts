import { type NextRequest, NextResponse } from "next/server";

import {
  isMetaOAuthConfigured,
  META_OAUTH_SCOPES,
  signMetaOAuthState,
} from "@/lib/auth/meta-oauth-state";
import { resolveCompanyAuthContext } from "@/lib/auth/resolve-company-auth";

const META_OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

export async function GET(req: NextRequest) {
  if (!isMetaOAuthConfigured()) {
    const isOnboarding = req.nextUrl.searchParams.get("onboarding") === "1";
    const dest = isOnboarding
      ? "/signup?step=facebook&status=error&reason=config"
      : "/profile/integration?meta_oauth=config";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  const isOnboarding = req.nextUrl.searchParams.get("onboarding") === "1";
  const ctx = await resolveCompanyAuthContext();
  if (!ctx) {
    const dest = isOnboarding
      ? "/signup?step=facebook&status=error&reason=session"
      : "/login?meta_oauth=session";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (isOnboarding && ctx.mode !== "onboarding") {
    return NextResponse.redirect(
      new URL("/signup?step=facebook&status=error&reason=session", req.url),
    );
  }

  const clientId = process.env.META_APP_ID!.trim();
  const redirectUri = process.env.META_REDIRECT_URI!.trim();
  const state = await signMetaOAuthState(ctx.companyId, {
    returnTo: isOnboarding ? "onboarding" : "integration",
  });

  const url = new URL(META_OAUTH_DIALOG);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_OAUTH_SCOPES);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url);
}
