import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shopifyShop.findFirst({
    where: { companyId: session.companyId, status: "installed" },
    select: { id: true },
  });

  if (!shop) {
    return NextResponse.json({ error: "No connected shop" }, { status: 404 });
  }

  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      status: "uninstalled",
      uninstalledAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
