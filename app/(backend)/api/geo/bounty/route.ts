import { NextResponse } from "next/server"
import { getSession }   from "@/lib/auth/session"
import { runBountyJob } from "@/lib/microservice/jobs/bounty-jobs"
import { SubscriptionLimitError } from "@/lib/subscription/check-limit"
import { prisma } from "@/lib/prisma"

export const maxDuration = 300;

export async function POST() {
  const session = await getSession()
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
  }
  try {
    const result = await runBountyJob(session.companyId)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof SubscriptionLimitError) {
      return NextResponse.json(
        { success: false, error: err.message, usage: err.usage },
        { status: 403 }
      )
    }
    console.error("Bounty error:", err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 502 })
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const topics = await prisma.llmTopic.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    include: {
      prompts: {
        where: { isActive: true },
        select: { id: true, query: true },
      },
    },
  });

  const niches = topics.map((t) => ({
    id: t.id,
    topic: t.name,
    description: t.description ?? "",
    difficulty: t.difficulty,
    prompts: t.prompts.map((p) => ({ id: p.id, query: p.query })),
    prompt_count: t.prompts.length,
  }));

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const n of niches) {
    const k = n.difficulty.toLowerCase();
    if (k in byDifficulty) (byDifficulty as Record<string, number>)[k]++;
  }

  return NextResponse.json({
    success: true,
    niches,
    summary: {
      total_niches: niches.length,
      total_prompts: niches.reduce((s, n) => s + n.prompt_count, 0),
      by_difficulty: byDifficulty,
    },
  });
}

const MAX_BULK_DELETE = 500;

/** Bulk-delete bounty topics: body `{ ids: string[] }`. Only the caller's company topics are touched. */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: "No topic ids provided" }, { status: 400 });
  }
  if (ids.length > MAX_BULK_DELETE) {
    return NextResponse.json(
      { success: false, error: `Cannot delete more than ${MAX_BULK_DELETE} topics at once` },
      { status: 400 }
    );
  }

  const where = { id: { in: ids }, companyId: session.companyId };
  // FKs to llm_topics are ON DELETE SET NULL, so published pages and metrics survive.
  // Deactivate the topic's prompts so they don't linger as orphaned active prompts.
  const [, deleted] = await prisma.$transaction([
    prisma.prompt.updateMany({
      where: { llmTopic: where },
      data: { isActive: false },
    }),
    prisma.llmTopic.deleteMany({ where }),
  ]);

  return NextResponse.json({ success: true, deleted: deleted.count });
}
