import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseSpreadPlatforms } from "@/lib/geo/bounty/spread-platforms";
import { runGetCitedForCompany } from "@/lib/geo/bounty/runGetCitedForCompany";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { query?: string; promptId?: string; platforms?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ success: false, error: "query is required" }, { status: 400 });
  }

  const platforms = parseSpreadPlatforms(body?.platforms);
  if (platforms.length === 0) {
    return NextResponse.json(
      { success: false, error: "At least one platform must be selected" },
      { status: 400 }
    );
  }

  const promptId =
    typeof body?.promptId === "string" && body.promptId.trim() ? body.promptId.trim() : null;

  try {
    const responseBody = await runGetCitedForCompany({
      companyId: session.companyId,
      query,
      platforms,
      promptId,
    });

    if (!responseBody.success) {
      return NextResponse.json(responseBody, { status: 502 });
    }

    const allSuccess = responseBody.results.every((r) => r.success);
    return NextResponse.json(responseBody, { status: allSuccess ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Get cited failed",
      },
      { status: 400 }
    );
  }
}
