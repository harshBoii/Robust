import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveBountyToShopify } from "@/lib/geo/bounty/approveBountyToShopify";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await context.params;
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const companyId = session.companyId;
  try {
    const result = await approveBountyToShopify({ companyId, bountyId });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
