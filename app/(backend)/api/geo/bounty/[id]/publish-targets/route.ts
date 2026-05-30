import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getPublishAdapter } from "@/lib/geo/bounty/publish";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";

const SOCIAL_PLATFORMS: BountySpreadPlatform[] = ["X", "LINKEDIN", "REDDIT", "THIRD_PARTY_BLOG"];

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

  const shopify = await prisma.shopifyShop.findFirst({
    where: { companyId, status: "installed" },
    select: { id: true },
  });

  const websiteBlogAvailability = await getPublishAdapter("WEBSITE_BLOG").isAvailable(companyId);

  const social: Record<string, { available: boolean; reason?: string }> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    social[platform] = await getPublishAdapter(platform).isAvailable(companyId);
  }

  const integrations = await prisma.socialIntegration.findMany({
    where: { companyId },
    select: { provider: true, accountHandle: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      shopify: { available: Boolean(shopify) },
      wordpressWoo: { available: false, reason: "WordPress integration not yet configured" },
      websiteBlog: websiteBlogAvailability,
      social,
      connectedAccounts: integrations.map((i) => ({
        provider: i.provider,
        accountHandle: i.accountHandle,
      })),
    },
  });
}
