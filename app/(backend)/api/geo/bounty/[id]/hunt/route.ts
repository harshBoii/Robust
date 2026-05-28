import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { huntBountyForCompany } from "@/lib/geo/bounty/huntForCompany";
import { SubscriptionLimitError } from "@/lib/subscription/check-limit";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: bountyId } = await context.params;
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const companyId = session.companyId;

  try {
    const result = await huntBountyForCompany({ companyId, bountyId });
    return NextResponse.json({ success: true, aeoPageId: result.aeoPageId });
  } catch (err) {
    if (err instanceof SubscriptionLimitError) {
      return NextResponse.json(
        { success: false, error: err.message, usage: err.usage },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message ?? "Bounty hunt failed" },
      { status: 500 }
    );
  }
}

