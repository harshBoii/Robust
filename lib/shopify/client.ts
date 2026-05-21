import type { ShopifyConfig } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export function buildInstallUrl(
  shop: string,
  config: ShopifyConfig,
  state: string,
): string {
  const shopDomain = normalizeShopDomain(shop);
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", config.apiKey);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export type ShopifyTokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeShopifyAccessToken(
  shop: string,
  code: string,
  config: ShopifyConfig,
): Promise<ShopifyTokenResponse> {
  const shopDomain = normalizeShopDomain(shop);
  const url = `https://${shopDomain}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code,
    }),
    cache: "no-store",
  });
  return (await res.json()) as ShopifyTokenResponse;
}

export function toAbsoluteUrl(href: string, requestUrl: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(trimmed, requestUrl).toString();
  }
}
