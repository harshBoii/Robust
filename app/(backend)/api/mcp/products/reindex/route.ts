import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isElasticsearchConfigured } from "@/lib/elasticsearch/client";
import { bulkReindexFromDb } from "@/lib/elasticsearch/products";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElasticsearchConfigured()) {
    return NextResponse.json(
      { error: "Elasticsearch is not configured" },
      { status: 503 },
    );
  }

  const result = await bulkReindexFromDb(session.companyId);

  return NextResponse.json({ success: true, ...result });
}
