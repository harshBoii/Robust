import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

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

  return NextResponse.json({
    success: true,
    data: {
      shopify: { available: Boolean(shopify) },
      wordpressWoo: { available: false, reason: "WordPress integration not yet configured" },
    },
  });
}
