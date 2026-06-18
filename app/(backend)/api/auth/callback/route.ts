import { type NextRequest, NextResponse } from "next/server";

import { getOnboardingSession } from "@/lib/auth/onboarding-session";
import { verifyMetaOAuthState } from "@/lib/auth/meta-oauth-state";
import { resolveCompanyAuthContext } from "@/lib/auth/resolve-company-auth";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_OAUTH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;

function requireMetaOAuthEnv() {
  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

function redirect(req: NextRequest, pathname: string, query?: Record<string, string>) {
  const url = new URL(pathname, req.url);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return NextResponse.redirect(url);
}

type TokenResponse = {
  access_token?: string;
  error?: { message?: string; type?: string; code?: number };
};

async function fetchJson(url: string): Promise<TokenResponse> {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as TokenResponse;
  return data;
}

function metaSuccessRedirect(req: NextRequest, returnTo: "onboarding" | "integration") {
  if (returnTo === "onboarding") {
    return redirect(req, "/signup", { step: "facebook", status: "connected" });
  }
  return redirect(req, "/profile/integration", { meta_oauth: "connected" });
}

function metaErrorRedirect(
  req: NextRequest,
  returnTo: "onboarding" | "integration",
  reason?: string,
) {
  if (returnTo === "onboarding") {
    return redirect(req, "/signup", {
      step: "facebook",
      status: "error",
      ...(reason ? { reason } : {}),
    });
  }
  return redirect(req, "/profile/integration", {
    meta_oauth: "error",
    ...(reason ? { reason } : {}),
  });
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const stateParam = searchParams.get("state");
  const stateData = stateParam ? await verifyMetaOAuthState(stateParam) : null;
  const returnTo = stateData?.returnTo ?? "integration";

  if (oauthError) {
    console.error("[meta oauth callback] provider error:", oauthError, oauthErrorDescription ?? "");
    return metaErrorRedirect(req, returnTo);
  }

  const code = searchParams.get("code");
  if (!code) {
    return metaErrorRedirect(req, returnTo, "missing_code");
  }

  const env = requireMetaOAuthEnv();
  if (!env) {
    console.error("[meta oauth callback] META_APP_ID, META_APP_SECRET, or META_REDIRECT_URI missing");
    return metaErrorRedirect(req, returnTo, "config");
  }

  const ctx = await resolveCompanyAuthContext();
  if (!ctx) {
    const dest =
      returnTo === "onboarding"
        ? "/signup?step=facebook&status=error&reason=session"
        : "/login?meta_oauth=session";
    return redirect(req, dest);
  }

  if (stateData) {
    if (stateData.companyId !== ctx.companyId) {
      return metaErrorRedirect(req, returnTo, "invalid_state");
    }
    if (returnTo === "onboarding" && ctx.mode !== "onboarding") {
      const onboarding = await getOnboardingSession();
      if (!onboarding || onboarding.companyId !== stateData.companyId) {
        return metaErrorRedirect(req, returnTo, "invalid_state");
      }
    }
    if (returnTo === "integration") {
      const session = await getSession();
      if (!session || session.companyId !== ctx.companyId) {
        return redirect(req, "/login", { meta_oauth: "session" });
      }
    }
  } else if (returnTo === "integration") {
    const session = await getSession();
    if (!session || session.companyId !== ctx.companyId) {
      return redirect(req, "/login", { meta_oauth: "session" });
    }
  }

  const shortParams = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    code,
  });
  const shortLivedUrl = `${META_GRAPH_OAUTH_BASE}?${shortParams.toString()}`;
  const shortData = await fetchJson(shortLivedUrl);

  if (shortData.error || !shortData.access_token) {
    console.error("[meta oauth callback] short-lived token exchange failed");
    return metaErrorRedirect(req, returnTo, "token_exchange");
  }

  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    fb_exchange_token: shortData.access_token,
  });
  const longLivedUrl = `${META_GRAPH_OAUTH_BASE}?${longParams.toString()}`;
  const longData = await fetchJson(longLivedUrl);

  if (longData.error || !longData.access_token) {
    console.error("[meta oauth callback] long-lived token exchange failed");
    return metaErrorRedirect(req, returnTo, "token_exchange");
  }

  await prisma.metaIntegration.upsert({
    where: { companyId: ctx.companyId },
    create: {
      companyId: ctx.companyId,
      accessToken: longData.access_token,
    },
    update: {
      accessToken: longData.access_token,
    },
  });

  return metaSuccessRedirect(req, returnTo);
}
