import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { syncBountyRevenueForCompany } from "@/lib/geo/radar/bountySync";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { query?: string; promptId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ success: false, error: "query is required" }, { status: 400 });
  }

  const promptId =
    typeof body?.promptId === "string" && body.promptId.trim() ? body.promptId.trim() : null;

  const companyId = session.companyId;

  const bounty = await prisma.citationBounty.create({
    data: {
      companyId,
      query,
      pageType: "USE_CASE",
      confidence: 50,
      status: "OPEN",
    },
    select: { id: true },
  });

  await syncBountyRevenueForCompany(prisma, companyId);

  const origin = request.nextUrl.origin;
  const huntUrl = `${origin}/api/geo/bounty/${bounty.id}/hunt`;

  try {
    const huntRes = await fetch(huntUrl, {
      method: "POST",
      // Forward the user's auth cookie; Next middleware blocks the hunt endpoint
      // unless the `auth` cookie is present.
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
    });
    const contentType = huntRes.headers.get("content-type") ?? "";
    const rawText = await huntRes.text().catch(() => "");

    console.log("[geo/bounty/get-cited] hunt response", {
      url: huntUrl,
      status: huntRes.status,
      contentType,
      responsePreview: rawText?.slice(0, 2000) ?? "",
    });

    type HuntResponse = {
      success?: boolean;
      error?: string;
      aeoPageId?: string | null;
    };

    let huntData: HuntResponse | null = null;
    if (contentType.includes("application/json")) {
      try {
        huntData = rawText ? JSON.parse(rawText) : null;
      } catch {
        huntData = null;
      }
    }

    if (!huntRes.ok || !huntData?.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            huntData?.error ??
            (contentType.includes("application/json") ? "Hunt failed" : "Hunt returned non-JSON (likely redirected)"),
          bountyId: bounty.id,
        },
        { status: huntRes.status >= 400 ? huntRes.status : 502 }
      );
    }

    if (promptId) {
      const ownedPrompt = await prisma.prompt.findFirst({
        where: {
          id: promptId,
          llmTopic: { companyId },
        },
        select: { id: true },
      });
      if (ownedPrompt) {
        await prisma.prompt.update({
          where: { id: promptId },
          data: { ishunted: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      bountyId: bounty.id,
      aeoPageId: huntData.aeoPageId ?? null,
    });
  } catch (err) {
    console.error("Get cited hunt request failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run hunt",
        bountyId: bounty.id,
      },
      { status: 502 }
    );
  }
}
