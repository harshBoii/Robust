import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { processPendingImageThumbnails } from "@/lib/gallery/image-thumbnail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const authorization = request.headers.get("authorization") ?? "";
  return safeEqual(authorization, `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processPendingImageThumbnails({
      limit: 50,
      concurrency: 3,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/image-thumbnails]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Thumbnail backfill failed",
      },
      { status: 500 },
    );
  }
}
