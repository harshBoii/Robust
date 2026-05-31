import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  createShopifyOAuthState,
  setShopifyOAuthStateCookie,
} from "@/lib/auth/shopify-oauth-state";
import { buildInstallUrl } from "@/lib/shopify/client";
import { getShopifyConfig } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const rawShop =
    request.nextUrl.searchParams.get("shop")?.trim() || "";
  const shop = normalizeShopDomain(rawShop);
  if (!shop) {
    return NextResponse.redirect(
      new URL("/profile/integration?shopify_error=invalid_shop", request.url),
    );
  }

  const config = await getShopifyConfig(session.companyId);
  if (!config) {
    return NextResponse.redirect(
      new URL("/profile/integration?shopify_error=config", request.url),
    );
  }

  const payload = createShopifyOAuthState(shop, session.companyId);
  const installUrl = buildInstallUrl(shop, config, payload.state);
  const response = NextResponse.redirect(installUrl);
  setShopifyOAuthStateCookie(
    response,
    payload,
    process.env.NODE_ENV === "production",
  );
  return response;
}
