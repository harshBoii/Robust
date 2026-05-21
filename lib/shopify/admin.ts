import { getShopifyApiVersion } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export type ShopifyGraphqlResponse<T = unknown> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function shopifyAdminGraphql<T = unknown>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphqlResponse<T>> {
  const shop = normalizeShopDomain(shopDomain);
  const url = `https://${shop}/admin/api/${getShopifyApiVersion()}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as ShopifyGraphqlResponse<T>;
}
