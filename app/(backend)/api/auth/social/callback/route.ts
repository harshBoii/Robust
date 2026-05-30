import { type NextRequest, NextResponse } from "next/server";
import {
  getSocialOAuthEnv,
  verifySocialOAuthState,
} from "@/lib/auth/social-oauth-state";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function redirect(req: NextRequest, query?: Record<string, string>) {
  const url = new URL("/manager/social", req.url);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return NextResponse.redirect(url);
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirect(req, { oauth: "error", message: oauthError });
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirect(req, { oauth: "error", message: "missing_code" });
  }

  const stateParam = searchParams.get("state");
  if (!stateParam) {
    return redirect(req, { oauth: "error", message: "missing_state" });
  }

  const verified = await verifySocialOAuthState(stateParam);
  if (!verified) {
    return redirect(req, { oauth: "error", message: "invalid_state" });
  }

  const session = await getSession();
  if (!session || session.companyId !== verified.companyId) {
    return redirect(req, { oauth: "error", message: "session" });
  }

  const env = getSocialOAuthEnv(verified.provider);
  if (!env) {
    return redirect(req, { oauth: "error", message: "config" });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.redirectUri,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });

  if (verified.provider === "X") {
    body.set("code_verifier", "challenge");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (verified.provider === "REDDIT") {
    const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
    body.delete("client_secret");
  }

  const tokenRes = await fetch(env.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
    cache: "no-store",
  });

  const tokenData = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("[social oauth callback] token exchange failed", tokenData);
    return redirect(req, { oauth: "error", message: "token_exchange" });
  }

  const expiresAt =
    typeof tokenData.expires_in === "number"
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

  await prisma.socialIntegration.upsert({
    where: {
      companyId_provider: {
        companyId: session.companyId,
        provider: verified.provider,
      },
    },
    create: {
      companyId: session.companyId,
      provider: verified.provider,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt,
    },
    update: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt,
    },
  });

  return redirect(req, {
    oauth: "connected",
    provider: verified.provider.toLowerCase(),
  });
}
