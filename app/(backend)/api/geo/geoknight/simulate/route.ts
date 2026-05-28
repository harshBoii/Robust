import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const promptId = req.nextUrl.searchParams.get('promptId')?.trim() ?? '';
  if (!promptId) {
    return NextResponse.json({ success: false, error: 'promptId is required' }, { status: 400 });
  }

  const companyId = session.companyId;

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      query: true,
      llmTopic: { select: { companyId: true } },
      executions: {
        where: { citations: { some: { companyId } } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!prompt) {
    return NextResponse.json({ success: false, error: 'Prompt not found' }, { status: 404 });
  }

  const allowed = prompt.llmTopic?.companyId === companyId || prompt.executions.length > 0;
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const executions = await prisma.promptExecution.findMany({
    where: { promptId },
    orderBy: { executedAt: 'desc' },
    take: 12,
    select: {
      id: true,
      model: true,
      executedAt: true,
      response: true,
    },
  });

  return NextResponse.json({
    success: true,
    prompt: { id: prompt.id, query: prompt.query },
    executions: executions.map((e) => ({
      id: e.id,
      model: e.model,
      executedAt: e.executedAt.toISOString(),
      response: e.response ?? '',
    })),
  });
}
