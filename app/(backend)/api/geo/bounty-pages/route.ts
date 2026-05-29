import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const bounties = await prisma.citationBounty.findMany({
    where: {
      companyId: session.companyId,
      aeoPageId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    include: {
      aeoPage: {
        select: {
          id: true,
          slug: true,
          locale: true,
          title: true,
          description: true,
          status: true,
          pageType: true,
          publishedAt: true,
          canonicalUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ success: true, bounties });
}
