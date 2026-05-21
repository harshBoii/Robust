import { NextRequest, NextResponse } from "next/server";

import { IntegrationProvider } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { getShopifyConfig } from "@/lib/shopify/config";
import { normalizeShopDomain } from "@/lib/shopify/domain";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = {
  expectedShopDomain?: unknown;
  apiKey?: unknown;
  apiSecret?: unknown;
  scopes?: unknown;
  appUrl?: unknown;
  connectUrl?: unknown;
};

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cms, shop, envConfigured] = await Promise.all([
    prisma.companyIntegrationCms.findUnique({
      where: {
        companyId_provider: {
          companyId: session.companyId,
          provider: IntegrationProvider.Shopify,
        },
      },
    }),
    prisma.shopifyShop.findFirst({
      where: { companyId: session.companyId },
      orderBy: { updatedAt: "desc" },
      select: {
        shopDomain: true,
        scopes: true,
        status: true,
        uninstalledAt: true,
        updatedAt: true,
      },
    }),
    getShopifyConfig(session.companyId),
  ]);

  return NextResponse.json({
    cms: cms
      ? {
          id: cms.id,
          expectedShopDomain: cms.expectedShopDomain,
          apiKey: cms.apiKey,
          hasApiSecret: Boolean(cms.apiSecret),
          scopes: cms.scopes,
          appUrl: cms.appUrl,
          connectUrl: cms.connectUrl,
        }
      : null,
    shop,
    connected: shop?.status === "installed",
    envConfigured: Boolean(envConfigured),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expectedRaw =
    typeof body.expectedShopDomain === "string" ? body.expectedShopDomain : undefined;
  const expectedShopDomain = expectedRaw
    ? normalizeShopDomain(expectedRaw) || null
    : undefined;

  if (expectedRaw && !expectedShopDomain) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  if (expectedShopDomain) {
    const conflict = await prisma.companyIntegrationCms.findFirst({
      where: {
        expectedShopDomain,
        NOT: { companyId: session.companyId },
      },
      select: { companyId: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Shop domain is registered to another workspace" },
        { status: 409 },
      );
    }
  }

  const data: {
    expectedShopDomain?: string | null;
    apiKey?: string | null;
    apiSecret?: string | null;
    scopes?: string | null;
    appUrl?: string | null;
    connectUrl?: string | null;
  } = {};

  if (expectedShopDomain !== undefined) {
    data.expectedShopDomain = expectedShopDomain;
  }
  if (typeof body.apiKey === "string") data.apiKey = body.apiKey.trim() || null;
  if (typeof body.apiSecret === "string") data.apiSecret = body.apiSecret.trim() || null;
  if (typeof body.scopes === "string") data.scopes = body.scopes.trim() || null;
  if (typeof body.appUrl === "string") data.appUrl = body.appUrl.trim() || null;
  if (typeof body.connectUrl === "string") data.connectUrl = body.connectUrl.trim() || null;

  const cms = await prisma.companyIntegrationCms.upsert({
    where: {
      companyId_provider: {
        companyId: session.companyId,
        provider: IntegrationProvider.Shopify,
      },
    },
    create: {
      companyId: session.companyId,
      provider: IntegrationProvider.Shopify,
      ...data,
    },
    update: data,
  });

  return NextResponse.json({
    cms: {
      id: cms.id,
      expectedShopDomain: cms.expectedShopDomain,
      apiKey: cms.apiKey,
      hasApiSecret: Boolean(cms.apiSecret),
      scopes: cms.scopes,
      appUrl: cms.appUrl,
      connectUrl: cms.connectUrl,
    },
  });
}
