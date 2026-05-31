import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  clearShopifyOAuthStateOnResponse,
  readShopifyOAuthStateFromRequest,
} from "@/lib/auth/shopify-oauth-state";
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = normalizeShopDomain(searchParams.get("shop") ?? "");
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!shop || !code) {
    const res = redirect(request, "/profile/integration", { shopify_error: "missing_params" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  const cookieState = readShopifyOAuthStateFromRequest(request);
  if (!cookieState || cookieState.shop !== shop) {
    const res = redirect(request, "/profile/integration", { shopify_error: "invalid_state" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  if (stateParam && stateParam !== cookieState.state) {
    const res = redirect(request, "/profile/integration", { shopify_error: "invalid_state" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  const session = await getSession();
  if (!session || session.companyId !== cookieState.companyId) {
    const res = redirect(request, "/login", { shopify_error: "session" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  const config = await getShopifyConfig(session.companyId);
  if (!config) {
    const res = redirect(request, "/profile/integration", { shopify_error: "config" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  if (!verifyHmacFromSearchParams(searchParams, config.apiSecret)) {
    const res = redirect(request, "/profile/integration", { shopify_error: "hmac" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  const existing = await prisma.shopifyShop.findUnique({
    where: { shopDomain: shop },
    select: { companyId: true },
  });
  if (existing && existing.companyId !== session.companyId) {
    const res = redirect(request, "/profile/integration", { shopify_error: "shop_taken" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  const tokenData = await exchangeShopifyAccessToken(shop, code, config);
  const accessToken = tokenData.access_token?.trim();
  if (!accessToken) {
    console.error("[shopify callback] token exchange failed", tokenData.error);
    const res = redirect(request, "/profile/integration", { shopify_error: "token_exchange" });
    clearShopifyOAuthStateOnResponse(res);
    return res;
  }

  const scopes = tokenData.scope?.trim() || config.scopes;

  await prisma.shopifyShop.upsert({
    where: { shopDomain: shop },
    create: {
      companyId: session.companyId,
      shopDomain: shop,
      accessToken,
      scopes,
      status: "installed",
    },
    update: {
      companyId: session.companyId,
      accessToken,
      scopes,
      status: "installed",
      uninstalledAt: null,
    },
  });

  const res = redirect(request, "/profile/integration", { shopify_connected: "1" });
  clearShopifyOAuthStateOnResponse(res);
  return res;
}
