import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { syncBountyRevenueForCompany } from "@/lib/geo/radar/bountySync";
import { minimalMarkdownToHtml } from "@/lib/geo/bounty/markdownToHtmlForPublish";
import { wpSafeFetch } from "@/lib/wordpress/client";

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

  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId },
    select: {
      id: true,
      query: true,
      aeoPage: {
        select: {
          id: true,
          slug: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          description: true,
        },
      },
    },
  });

  if (!bounty || !bounty.aeoPage) {
    return NextResponse.json(
      { success: false, error: "Bounty or generated page not found" },
      { status: 404 }
    );
  }

  const aeoPage = bounty.aeoPage;
  const title = (aeoPage.seoTitle ?? aeoPage.title ?? bounty.query).trim();
  const html = minimalMarkdownToHtml(aeoPage.description ?? "");
  const excerpt = (aeoPage.seoDescription ?? "").trim();

  try {
    const { data: post } = await wpSafeFetch(companyId, (wp) =>
      wp.createPost({
        title,
        slug: aeoPage.slug,
        status: "publish",
        content: html,
        ...(excerpt ? { excerpt } : {}),
      })
    );

    const link =
      typeof post?.link === "string"
        ? post.link
        : typeof post?.guid?.rendered === "string"
          ? post.guid.rendered
          : null;

    if (link) {
      await prisma.aeoPage.update({
        where: { id: aeoPage.id },
        data: { canonicalUrl: link.slice(0, 1000) },
      });
    }

    await prisma.citationBounty.update({
      where: { id: bountyId },
      data: { publishedAt: new Date() },
    });
    await syncBountyRevenueForCompany(prisma, companyId);

    return NextResponse.json({
      success: true,
      data: {
        postId: post?.id ?? null,
        link: link ?? undefined,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "WP_NOT_CONNECTED") {
      return NextResponse.json(
        { success: false, error: "WordPress not connected" },
        { status: 404 }
      );
    }
    if (msg === "WP_UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "WordPress rejected credentials — reconnect in Connection" },
        { status: 401 }
      );
    }
    if (msg.startsWith("WP_ERROR:")) {
      const code = msg.replace("WP_ERROR:", "");
      return NextResponse.json(
        { success: false, error: `WordPress API error (${code})` },
        { status: 502 }
      );
    }
    console.error("[geo/approve-wordpress]", err);
    return NextResponse.json(
      { success: false, error: msg || "Failed to publish to WordPress" },
      { status: 502 }
    );
  }
}
