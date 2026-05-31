import { NextRequest, NextResponse } from "next/server";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { publishBountyContent } from "@/lib/geo/bounty/publish";
import { parseSpreadPlatforms } from "@/lib/geo/bounty/spread-platforms";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: bountyId } = await context.params;
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    platform?: string;
    contentId?: string;
    approveAll?: boolean;
    redditSubreddit?: string;
    redditFlairId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.approveAll) {
    const { prisma } = await import("@/lib/prisma");
    const contents = await prisma.bountyContent.findMany({
      where: {
        bountyId,
        companyId: session.companyId,
        status: { in: ["DRAFT", "APPROVED", "FAILED"] },
      },
      select: { id: true, platform: true, status: true },
    });

    const results = [];
    for (const content of contents) {
      if (content.status === "PUBLISHED") continue;
      try {
        const result = await publishBountyContent({
          companyId: session.companyId,
          bountyId,
          platform: content.platform,
          contentId: content.id,
        });
        results.push({ platform: content.platform, success: true, ...result });
      } catch (err) {
        results.push({
          platform: content.platform,
          success: false,
          error: err instanceof Error ? err.message : "Publish failed",
        });
      }
    }

    const websiteResult = await publishWebsiteBlogIfRequested(session.companyId, bountyId, body);
    if (websiteResult) results.push(websiteResult);

    const anySuccess = results.some((r) => r.success);
    return NextResponse.json(
      { success: anySuccess, results },
      { status: anySuccess ? 200 : 502 }
    );
  }

  const contentId =
    typeof body.contentId === "string" && body.contentId.trim() ? body.contentId.trim() : undefined;
  const platform =
    typeof body.platform === "string" ? (body.platform as BountySpreadPlatform) : undefined;

  if (!contentId && !platform) {
    return NextResponse.json(
      { success: false, error: "platform or contentId is required" },
      { status: 400 }
    );
  }

  const validPlatforms = parseSpreadPlatforms(platform ? [platform] : []);
  const resolvedPlatform = validPlatforms[0];
  if (!resolvedPlatform && !contentId) {
    return NextResponse.json({ success: false, error: "Invalid platform" }, { status: 400 });
  }

  try {
    if (resolvedPlatform === "WEBSITE_BLOG") {
      const result = await publishBountyContent({
        companyId: session.companyId,
        bountyId,
        platform: "WEBSITE_BLOG",
      });
      return NextResponse.json({ success: true, data: result });
    }

    const redditSubreddit =
      typeof body.redditSubreddit === 'string' ? body.redditSubreddit.trim() : '';
    if (resolvedPlatform === 'REDDIT' && !redditSubreddit) {
      return NextResponse.json(
        { success: false, error: 'Select a subreddit or your profile before publishing to Reddit' },
        { status: 400 },
      );
    }

    const result = await publishBountyContent({
      companyId: session.companyId,
      bountyId,
      platform: resolvedPlatform!,
      contentId,
      reddit:
        resolvedPlatform === 'REDDIT'
          ? {
              subreddit: redditSubreddit,
              ...(typeof body.redditFlairId === 'string' && body.redditFlairId.trim()
                ? { flairId: body.redditFlairId.trim() }
                : {}),
            }
          : undefined,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    const status = message.includes("already published") ? 409 : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

async function publishWebsiteBlogIfRequested(
  companyId: string,
  bountyId: string,
  body: { platform?: string; approveAll?: boolean }
) {
  if (body.platform !== "WEBSITE_BLOG" && !body.approveAll) return null;
  try {
    const result = await publishBountyContent({
      companyId,
      bountyId,
      platform: "WEBSITE_BLOG",
    });
    return { platform: "WEBSITE_BLOG" as const, success: true, ...result };
  } catch (err) {
    return {
      platform: "WEBSITE_BLOG" as const,
      success: false,
      error: err instanceof Error ? err.message : "Publish failed",
    };
  }
}
