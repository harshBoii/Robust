import { getShopifyApiVersion } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";
import { shopifyAdminGraphql } from "@/lib/shopify/admin";

const LIST_PRODUCTS_QUERY = `
  query ListProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          status
          totalInventory
          onlineStoreUrl
          createdAt
          updatedAt
          description
          featuredImage {
            url
            altText
            width
            height
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
    }
  }
`;

export type ShopifyProductNode = {
  id: string;
  title?: string | null;
  status?: string | null;
  totalInventory?: number | null;
  onlineStoreUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  description?: string | null;
  featuredImage?: {
    url?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  priceRangeV2?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null;
    maxVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null;
  } | null;
  variants?: {
    edges?: Array<{ node?: { price?: string | null } | null }>;
  } | null;
};

export type ListProductsData = {
  products?: {
    edges?: Array<{ node?: ShopifyProductNode | null }>;
  };
};

const SYNC_FIRST = 50;

export async function fetchShopifyProducts(shop: {
  shopDomain: string;
  accessToken: string;
}): Promise<{
  data: ListProductsData | undefined;
  errors?: Array<{ message: string }>;
  raw: unknown;
}> {
  const shopDomain = normalizeShopDomain(shop.shopDomain);
  const response = await shopifyAdminGraphql<ListProductsData>(
    shopDomain,
    shop.accessToken,
    LIST_PRODUCTS_QUERY,
    { first: SYNC_FIRST },
  );

  return {
    data: response.data,
    errors: response.errors,
    raw: response,
  };
}

export function parseShopifyAmount(amount: string | null | undefined): string | null {
  if (amount == null || amount === "") return null;
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return null;
  return n.toFixed(4);
}

export function parseShopifyDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Exported for tests / logging */
export function getListProductsEndpoint(shopDomain: string): string {
  return `https://${normalizeShopDomain(shopDomain)}/admin/api/${getShopifyApiVersion()}/graphql.json`;
}
