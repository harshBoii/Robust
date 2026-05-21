import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isElasticsearchConfigured } from "@/lib/elasticsearch/client";
import { searchProducts } from "@/lib/elasticsearch/products";

export const dynamic = "force-dynamic";

type SearchBody = {
  query?: unknown;
  limit?: unknown;
};

export async function POST(req: NextRequest) {
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

  let body: SearchBody = {};
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    body = {};
  }

  const query = typeof body.query === "string" ? body.query : "";
  const limit =
    typeof body.limit === "number" && body.limit > 0 && body.limit <= 100
      ? body.limit
      : 20;

  const hits = await searchProducts(session.companyId, query, limit);

  return NextResponse.json({ hits, query, limit });
}
