import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { normalizeSiteUrlForPublish } from "@/lib/geo/bounty/normalizeSiteUrl";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await context.params;
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const companyId = session.companyId;

  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId },
    select: { id: true },
  });

  if (!bounty) {
    return NextResponse.json({ success: false, error: "Bounty not found" }, { status: 404 });
  }

  const [shopify, wpIntegration, wcStore] = await Promise.all([
    prisma.shopifyShop.findFirst({
      where: { companyId, status: "installed" },
      select: { id: true },
    }),
    prisma.wordPressIntegration.findUnique({
      where: { tenantId: companyId },
      select: { siteUrl: true, status: true },
    }),
    prisma.wooCommerceStore.findFirst({
      where: { companyId, status: "installed" },
      orderBy: { installedAt: "desc" },
      select: { storeUrl: true },
    }),
  ]);

  let wordpressWoo: { available: boolean; reason?: string };

  if (!wpIntegration || wpIntegration.status !== "active") {
    wordpressWoo = {
      available: false,
      reason: "WordPress not connected (Application Passwords)",
    };
  } else if (wcStore) {
    const wpNorm = normalizeSiteUrlForPublish(wpIntegration.siteUrl);
    const wcNorm = normalizeSiteUrlForPublish(wcStore.storeUrl);
    if (wpNorm === wcNorm) {
      wordpressWoo = { available: true };
    } else {
      wordpressWoo = {
        available: false,
        reason: "WordPress site URL must match your WooCommerce store URL",
      };
    }
  } else {
    wordpressWoo = { available: true };
  }

  return NextResponse.json({
    success: true,
    data: {
      shopify: { available: Boolean(shopify) },
      wordpressWoo,
    },
  });
}
