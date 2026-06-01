import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPublishTargetsForBounty } from "@/lib/geo/bounty/getPublishTargets";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await context.params;
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const data = await getPublishTargetsForBounty(session.companyId, bountyId);

  if (!data) {
    return NextResponse.json({ success: false, error: "Bounty not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
