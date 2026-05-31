import { type NextRequest, NextResponse } from "next/server";

import { verifyMetaOAuthState } from "@/lib/auth/meta-oauth-state";
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

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  if (oauthError) {
    console.error("[meta oauth callback] provider error:", oauthError, oauthErrorDescription ?? "");
    return redirect(req, "/profile/integration", { meta_oauth: "error" });
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirect(req, "/profile/integration", { meta_oauth: "missing_code" });
  }

  const env = requireMetaOAuthEnv();
  if (!env) {
    console.error("[meta oauth callback] META_APP_ID, META_APP_SECRET, or META_REDIRECT_URI missing");
    return redirect(req, "/profile/integration", { meta_oauth: "config" });
  }

  const session = await getSession();
  if (!session) {
    return redirect(req, "/login", { meta_oauth: "session" });
  }

  const stateParam = searchParams.get("state");
  if (stateParam) {
    const companyIdFromState = await verifyMetaOAuthState(stateParam);
    if (!companyIdFromState || companyIdFromState !== session.companyId) {
      return redirect(req, "/profile/integration", { meta_oauth: "invalid_state" });
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
    return redirect(req, "/profile/integration", { meta_oauth: "token_exchange" });
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
    return redirect(req, "/profile/integration", { meta_oauth: "token_exchange" });
  }

  await prisma.metaIntegration.upsert({
    where: { companyId: session.companyId },
    create: {
      companyId: session.companyId,
      accessToken: longData.access_token,
    },
    update: {
      accessToken: longData.access_token,
    },
  });

  return redirect(req, "/profile/integration", { meta_oauth: "connected" });
}
