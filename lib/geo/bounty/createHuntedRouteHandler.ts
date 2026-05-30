import { NextRequest, NextResponse } from "next/server";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { huntSocialForCompany } from "@/lib/geo/bounty/huntSocialForCompany";

export function createHuntedPlatformHandler(platform: BountySpreadPlatform) {
  return async function POST(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) {
    const { id: bountyId } = await context.params;
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    try {
      const result = await huntSocialForCompany({
        companyId: session.companyId,
        bountyId,
        platform,
      });
      return NextResponse.json({
        success: true,
        contentId: result.contentId,
        platform: result.platform,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hunt failed";
      console.error(`[geo/bounty/hunted/${platform.toLowerCase()}]`, err);
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  };
}
