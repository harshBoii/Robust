import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { loadBountyPagesData } from "@/lib/geo/bounty/loadBountyPagesData";

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const bounties = await loadBountyPagesData(session.companyId);

  return NextResponse.json({ success: true, bounties });
}
