import { NextResponse } from "next/server"
import { getSession }   from "@/lib/auth"
import { runBountyJob } from "@/lib/microservice/jobs/bounty-jobs"
import { SubscriptionLimitError } from "@/lib/subscription/check-limit"
import { prisma } from "@/lib/prisma"

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
