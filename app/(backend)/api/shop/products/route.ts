import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.shopifyProduct.findMany({
    where: { companyId: session.companyId },
    orderBy: { shopifyUpdatedAt: "desc" },
    select: {
      id: true,
      shopifyGid: true,
      title: true,
      status: true,
      handle: true,
      totalInventory: true,
      onlineStoreUrl: true,
      description: true,
      featuredImageUrl: true,
      featuredImageAltText: true,
      priceMinAmount: true,
      priceMaxAmount: true,
      currencyCode: true,
      shopifyCreatedAt: true,
      shopifyUpdatedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      ...p,
      priceMinAmount: p.priceMinAmount?.toString() ?? null,
      priceMaxAmount: p.priceMaxAmount?.toString() ?? null,
    })),
  });
}
