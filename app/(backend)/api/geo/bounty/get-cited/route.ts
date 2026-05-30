import { NextRequest, NextResponse } from "next/server";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { syncBountyRevenueForCompany } from "@/lib/geo/radar/bountySync";
import {
  getHuntedRouteSlug,
  parseSpreadPlatforms,
} from "@/lib/geo/bounty/spread-platforms";

type PlatformResult = {
  platform: BountySpreadPlatform;
  success: boolean;
  contentId?: string;
  aeoPageId?: string | null;
  error?: string;
};

async function callInternalPlatformRoute(opts: {
  origin: string;
  cookie: string;
  bountyId: string;
  platform: BountySpreadPlatform;
}): Promise<PlatformResult> {
  const slug = getHuntedRouteSlug(opts.platform);
  const path =
    opts.platform === "WEBSITE_BLOG"
      ? `/api/geo/bounty/${opts.bountyId}/hunt`
      : slug
        ? `/api/geo/bounty/${opts.bountyId}/hunted/${slug}`
        : null;

  if (!path) {
    return { platform: opts.platform, success: false, error: "Unknown platform route" };
  }

  try {
    const res = await fetch(`${opts.origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: opts.cookie,
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    const rawText = await res.text().catch(() => "");

    type ApiResponse = {
      success?: boolean;
      error?: string;
      aeoPageId?: string | null;
      contentId?: string;
    };

    let data: ApiResponse | null = null;
    if (contentType.includes("application/json")) {
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }
    }

    if (!res.ok || !data?.success) {
      return {
        platform: opts.platform,
        success: false,
        error:
          data?.error ??
          (contentType.includes("application/json")
            ? "Platform generation failed"
            : "Platform returned non-JSON (likely redirected)"),
      };
    }

    return {
      platform: opts.platform,
      success: true,
      aeoPageId: data.aeoPageId ?? null,
      contentId: data.contentId,
    };
  } catch (err) {
    return {
      platform: opts.platform,
      success: false,
      error: err instanceof Error ? err.message : "Platform request failed",
    };
  }
}

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

  const companyId = session.companyId;

  const bounty = await prisma.citationBounty.create({
    data: {
      companyId,
      query,
      pageType: "USE_CASE",
      confidence: 50,
      status: "OPEN",
      spreadPlatforms: platforms,
    },
    select: { id: true },
  });

  await syncBountyRevenueForCompany(prisma, companyId);

  const origin = request.nextUrl.origin;
  const cookie = request.headers.get("cookie") ?? "";

  const settled = await Promise.allSettled(
    platforms.map((platform) =>
      callInternalPlatformRoute({ origin, cookie, bountyId: bounty.id, platform })
    )
  );

  const results: PlatformResult[] = settled.map((entry, index) => {
    const platform = platforms[index]!;
    if (entry.status === "fulfilled") return entry.value;
    return {
      platform,
      success: false,
      error: entry.reason instanceof Error ? entry.reason.message : "Platform request failed",
    };
  });

  const anySuccess = results.some((r) => r.success);

  if (anySuccess && promptId) {
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

  const responseBody = {
    success: anySuccess,
    bountyId: bounty.id,
    results,
  };

  if (!anySuccess) {
    return NextResponse.json(responseBody, { status: 502 });
  }

  const allSuccess = results.every((r) => r.success);
  return NextResponse.json(responseBody, { status: allSuccess ? 200 : 207 });
}
