import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { reconcileProcessingVideoAssets } from "@/lib/cloudfare/stream";

function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.STREAM_QUEUE_RECONCILE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return null;
    return NextResponse.json(
      { error: "STREAM_QUEUE_RECONCILE_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer || !timingSafeEqualStrings(secret, bearer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Manual / cron: unblock VIDEO assets stuck in PROCESSING (queue + worker drain). */
export async function POST(req: NextRequest) {
  // const denied = authorize(req);
  // if (denied) return denied;

  let staleProcessingMs: number | undefined;
  let processBatchSize: number | undefined;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as {
        staleProcessingMs?: number;
        processBatchSize?: number;
      };
      if (
        typeof body.staleProcessingMs === "number" &&
        Number.isFinite(body.staleProcessingMs) &&
        body.staleProcessingMs >= 60_000
      ) {
        staleProcessingMs = body.staleProcessingMs;
      }
      if (
        typeof body.processBatchSize === "number" &&
        Number.isFinite(body.processBatchSize) &&
        body.processBatchSize >= 1 &&
        body.processBatchSize <= 50
      ) {
        processBatchSize = body.processBatchSize;
      }
    }
  } catch {
    /* empty body */
  }

  const summary = await reconcileProcessingVideoAssets({
    staleProcessingMs,
    processBatchSize,
  });

  return NextResponse.json(summary);
}
