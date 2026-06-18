import { type NextRequest, NextResponse } from "next/server";

import {
  createShopifyOAuthState,
  setShopifyOAuthStateCookie,
} from "@/lib/auth/shopify-oauth-state";
import { resolveCompanyAuthContext } from "@/lib/auth/resolve-company-auth";
import { buildInstallUrl } from "@/lib/shopify/client";
import { getShopifyConfig } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export async function GET(request: NextRequest) {
  const isOnboarding = request.nextUrl.searchParams.get("onboarding") === "1";
  const ctx = await resolveCompanyAuthContext();
  if (!ctx) {
    const dest = isOnboarding
      ? "/signup?step=shopify&status=error&reason=session"
      : "/login";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const rawShop = request.nextUrl.searchParams.get("shop")?.trim() || "";
  const shop = normalizeShopDomain(rawShop);
  if (!shop) {
    const dest = isOnboarding
      ? "/signup?step=shopify&status=error&reason=invalid_shop"
      : "/profile/integration?shopify_error=invalid_shop";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const config = await getShopifyConfig(ctx.companyId);
  if (!config) {
    const dest = isOnboarding
      ? "/signup?step=shopify&status=error&reason=config"
      : "/profile/integration?shopify_error=config";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const payload = createShopifyOAuthState(shop, ctx.companyId);
  const installUrl = buildInstallUrl(shop, config, payload.state);
  const response = NextResponse.redirect(installUrl);
  setShopifyOAuthStateCookie(
    response,
    payload,
    process.env.NODE_ENV === "production",
  );
  if (isOnboarding) {
    response.cookies.set("shopify_onboarding_return", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
  return response;
}
