import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { huntBountyForCompany } from "@/lib/geo/bounty/huntForCompany";

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
    return NextResponse.json(
      { success: false, error: (err as Error).message ?? "Bounty hunt failed" },
      { status: 500 }
    );
  }
}

