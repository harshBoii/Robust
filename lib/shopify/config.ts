import { IntegrationProvider } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type ShopifyConfig = {
  apiKey: string;
  apiSecret: string;
  scopes: string;
  appUrl: string;
  redirectUri: string;
  connectUrl: string | null;
};

const DEFAULT_API_VERSION = "2026-01";
const DEFAULT_SCOPES = "read_products";

export function getShopifyApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_API_VERSION;
}

export async function getShopifyConfig(
  companyId?: string | null,
): Promise<ShopifyConfig | null> {
  if (companyId) {
    const cms = await prisma.companyIntegrationCms.findUnique({
      where: {
        companyId_provider: {
          companyId,
          provider: IntegrationProvider.Shopify,
        },
      },
    });
    if (cms?.apiKey?.trim() && cms.apiSecret?.trim()) {
      const appUrl = (cms.appUrl?.trim() || process.env.SHOPIFY_APP_URL?.trim() || "").replace(
        /\/$/,
        "",
      );
      if (!appUrl) return null;
      return {
        apiKey: cms.apiKey.trim(),
        apiSecret: cms.apiSecret.trim(),
        scopes: cms.scopes?.trim() || process.env.SHOPIFY_SCOPES?.trim() || DEFAULT_SCOPES,
        appUrl,
        redirectUri: `${appUrl}/shopify/callback`,
        connectUrl: cms.connectUrl?.trim() || null,
      };
    }
  }

  const apiKey = process.env.SHOPIFY_API_KEY?.trim();
  const apiSecret = process.env.SHOPIFY_API_SECRET?.trim();
  const appUrl = process.env.SHOPIFY_APP_URL?.trim()?.replace(/\/$/, "");
  if (!apiKey || !apiSecret || !appUrl) return null;

  return {
    apiKey,
    apiSecret,
    scopes: process.env.SHOPIFY_SCOPES?.trim() || DEFAULT_SCOPES,
    appUrl,
    redirectUri: `${appUrl}/shopify/callback`,
    connectUrl: process.env.SHOPIFY_CONNECT_URL?.trim() || null,
  };
}

export function isShopifyConfigured(): boolean {
  return Boolean(
    (process.env.SHOPIFY_API_KEY?.trim() &&
      process.env.SHOPIFY_API_SECRET?.trim() &&
      process.env.SHOPIFY_APP_URL?.trim()) ||
      process.env.SHOPIFY_API_KEY?.trim(),
  );
}
