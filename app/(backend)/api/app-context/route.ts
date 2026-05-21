import { NextResponse } from "next/server";

import { IntegrationProvider } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { getShopifyConfig } from "@/lib/shopify/config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cms, shop] = await Promise.all([
    prisma.companyIntegrationCms.findUnique({
      where: {
        companyId_provider: {
          companyId: session.companyId,
          provider: IntegrationProvider.Shopify,
        },
      },
      select: {
        expectedShopDomain: true,
        connectUrl: true,
      },
    }),
    prisma.shopifyShop.findFirst({
      where: { companyId: session.companyId, status: "installed" },
      select: { shopDomain: true, scopes: true, updatedAt: true },
    }),
  ]);

  const config = await getShopifyConfig(session.companyId);

  return NextResponse.json({
    shopify: {
      connected: Boolean(shop),
      shopDomain: shop?.shopDomain ?? null,
      scopes: shop?.scopes ?? null,
      expectedShopDomain: cms?.expectedShopDomain ?? null,
      connectUrl: cms?.connectUrl ?? config?.connectUrl ?? null,
      oauthConfigured: Boolean(config),
    },
  });
}
