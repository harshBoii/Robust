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

  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId: session.companyId },
    select: {
      id: true,
      query: true,
      spreadPlatforms: true,
      aeoPage: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          status: true,
          canonicalUrl: true,
          publishedAt: true,
        },
      },
      contents: {
        select: {
          id: true,
          platform: true,
          status: true,
          title: true,
          body: true,
          publishedUrl: true,
          externalPostId: true,
          approvedAt: true,
          publishedAt: true,
          errorMessage: true,
          metadata: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!bounty) {
    return NextResponse.json({ success: false, error: "Bounty not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: bounty });
}
