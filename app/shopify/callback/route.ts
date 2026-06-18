import { type NextRequest, NextResponse } from "next/server";

import { getOnboardingSession } from "@/lib/auth/onboarding-session";
import {
  clearShopifyOAuthStateOnResponse,
  readShopifyOAuthStateFromRequest,
} from "@/lib/auth/shopify-oauth-state";
import { getSession } from "@/lib/auth/session";
import { exchangeShopifyAccessToken } from "@/lib/shopify/client";
import { getShopifyConfig } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";
import { verifyHmacFromSearchParams } from "@/lib/shopify/hmac";
import { prisma } from "@/lib/prisma";

function redirect(req: NextRequest, path: string, query?: Record<string, string>) {
  const url = new URL(path, req.url);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return NextResponse.redirect(url);
}

function shopifySuccessRedirect(req: NextRequest, onboardingReturn: boolean) {
  if (onboardingReturn) {
    return redirect(req, "/signup", { step: "shopify", status: "connected" });
  }
  return redirect(req, "/profile/integration", { shopify_connected: "1" });
}

function shopifyErrorRedirect(
  req: NextRequest,
  onboardingReturn: boolean,
  reason: string,
) {
  if (onboardingReturn) {
    return redirect(req, "/signup", { step: "shopify", status: "error", reason });
  }
  return redirect(req, "/profile/integration", { shopify_error: reason });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = normalizeShopDomain(searchParams.get("shop") ?? "");
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  const onboardingReturn = request.cookies.get("shopify_onboarding_return")?.value === "1";

  if (!shop || !code) {
    const res = shopifyErrorRedirect(request, onboardingReturn, "missing_params");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  const cookieState = readShopifyOAuthStateFromRequest(request);
  if (!cookieState || cookieState.shop !== shop) {
    const res = shopifyErrorRedirect(request, onboardingReturn, "invalid_state");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  if (stateParam && stateParam !== cookieState.state) {
    const res = shopifyErrorRedirect(request, onboardingReturn, "invalid_state");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  const authSession = await getSession();
  const onboardingSession = await getOnboardingSession();
  const companyId = authSession?.companyId ?? onboardingSession?.companyId;

  if (!companyId || companyId !== cookieState.companyId) {
    const res = onboardingReturn
      ? redirect(request, "/signup", { step: "shopify", status: "error", reason: "session" })
      : redirect(request, "/login", { shopify_error: "session" });
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  const config = await getShopifyConfig(companyId);
  if (!config) {
    const res = shopifyErrorRedirect(request, onboardingReturn, "config");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  if (!verifyHmacFromSearchParams(searchParams, config.apiSecret)) {
    const res = shopifyErrorRedirect(request, onboardingReturn, "hmac");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  const existing = await prisma.shopifyShop.findUnique({
    where: { shopDomain: shop },
    select: { companyId: true },
  });
  if (existing && existing.companyId !== companyId) {
    const res = shopifyErrorRedirect(request, onboardingReturn, "shop_taken");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  const tokenData = await exchangeShopifyAccessToken(shop, code, config);
  const accessToken = tokenData.access_token?.trim();
  if (!accessToken) {
    console.error("[shopify callback] token exchange failed", tokenData.error);
    const res = shopifyErrorRedirect(request, onboardingReturn, "token_exchange");
    clearShopifyOAuthStateOnResponse(res);
    res.cookies.delete("shopify_onboarding_return");
    return res;
  }

  const scopes = tokenData.scope?.trim() || config.scopes;

  await prisma.shopifyShop.upsert({
    where: { shopDomain: shop },
    create: {
      companyId,
      shopDomain: shop,
      accessToken,
      scopes,
      status: "installed",
    },
    update: {
      companyId,
      accessToken,
      scopes,
      status: "installed",
      uninstalledAt: null,
    },
  });

  const res = shopifySuccessRedirect(request, onboardingReturn);
  clearShopifyOAuthStateOnResponse(res);
  res.cookies.delete("shopify_onboarding_return");
  return res;
}
