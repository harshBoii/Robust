import { type NextRequest, NextResponse } from "next/server";

import { getShopifyConfig } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";
import { verifyHmacFromSearchParams } from "@/lib/shopify/hmac";
import { resolveCompanyIdForShopifyLoad } from "@/lib/shopify/resolveCompany";
import { prisma } from "@/lib/prisma";

/**
 * Embedded app entry from Shopify Admin.
 * Verifies HMAC; if shop is installed, redirect to workspace; else start OAuth install.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = normalizeShopDomain(searchParams.get("shop") ?? "");
  if (!shop) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const companyIdFromDomain = await resolveCompanyIdForShopifyLoad(shop);
  const config = await getShopifyConfig(companyIdFromDomain);
  if (!config) {
    return NextResponse.redirect(
      new URL("/manager/shopify?shopify_error=config", request.url),
    );
  }

  if (!verifyHmacFromSearchParams(searchParams, config.apiSecret)) {
    return NextResponse.redirect(
      new URL("/manager/shopify?shopify_error=hmac", request.url),
    );
  }

  const installed = await prisma.shopifyShop.findUnique({
    where: { shopDomain: shop },
    select: { status: true, companyId: true },
  });

  if (installed?.status === "installed") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  const installUrl = new URL("/shopify/install", request.url);
  installUrl.searchParams.set("shop", shop);
  return NextResponse.redirect(installUrl);
}
