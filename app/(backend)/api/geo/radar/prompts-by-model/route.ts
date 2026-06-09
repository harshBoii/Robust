import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const requesterCompanyId = session.companyId;
  const targetCompanyId = req.nextUrl.searchParams.get('companyId')?.trim() || requesterCompanyId;

  if (targetCompanyId !== requesterCompanyId) {
    const allowed = await prisma.companyRival.findFirst({
      where: { companyId: requesterCompanyId, rivalCompanyId: targetCompanyId },
      select: { id: true },
    });
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  const promptsByModelAgg = await prisma.llmPromptMetric.groupBy({
    by: ['model'],
    where: { companyId: targetCompanyId },
    _count: { promptId: true },
    orderBy: { _count: { promptId: 'desc' } },
  });

  const promptsByModel = promptsByModelAgg.map((g) => ({
    model: g.model,
    count: g._count.promptId,
  }));

  console.log('[geo/radar/prompts-by-model]', {
    requesterCompanyId,
    targetCompanyId,
    rows: promptsByModel.length,
    totalPrompts: promptsByModel.reduce((s, r) => s + r.count, 0),
    preview: promptsByModel.slice(0, 8),
  });

  return NextResponse.json({ success: true, companyId: targetCompanyId, promptsByModel });
}
