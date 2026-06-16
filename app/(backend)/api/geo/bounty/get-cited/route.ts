import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseSpreadPlatforms } from "@/lib/geo/bounty/spread-platforms";
import { runSingleBountyPageJob } from "@/lib/jobs/company-jobs/run-bounty-pages-batch";
import { MicroserviceGapError } from "@/lib/jobs/company-jobs/types";

export const maxDuration = 600;

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
    const result = await runSingleBountyPageJob(session.companyId, {
      query,
      platforms,
      promptId,
    });

    if (result.status === 'FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Get cited failed',
          ...(result.summary ?? {}),
        },
        { status: 502 },
      );
    }

    const summary = result.summary ?? {};
    const results = Array.isArray(summary.results) ? summary.results : [];
    const allSuccess = results.length === 0 || results.every((r: { success?: boolean }) => r.success);

    return NextResponse.json(
      {
        success: true,
        bountyId: summary.bountyId,
        results,
      },
      { status: allSuccess ? 200 : 207 },
    );
  } catch (err) {
    if (err instanceof MicroserviceGapError) {
      return NextResponse.json(
        {
          success: false,
          error: err.message,
          retryAfterSeconds: err.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(err.retryAfterSeconds) },
        },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Get cited failed",
      },
      { status: 400 }
    );
  }
}
