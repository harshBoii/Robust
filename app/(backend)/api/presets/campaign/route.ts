import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const presets = await prisma.campaignPreset.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });

  return NextResponse.json({ presets });
}

type PostBody = {
  name?: unknown;
  isDefault?: unknown;
  objective?: unknown;
  status?: unknown;
  spendCap?: unknown;
  dailyBudget?: unknown;
  lifetimeBudget?: unknown;
  bidStrategy?: unknown;
  specialAdCategories?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const preset = await prisma.campaignPreset.create({
    data: {
      companyId: session.companyId,
      name,
      isDefault: Boolean(body.isDefault),
      objective: typeof body.objective === 'string' ? body.objective : null,
      status: typeof body.status === 'string' ? body.status : null,
      spendCap: typeof body.spendCap === 'number' ? BigInt(Math.floor(body.spendCap)) : null,
      dailyBudget: typeof body.dailyBudget === 'number' ? BigInt(Math.floor(body.dailyBudget)) : null,
      lifetimeBudget: typeof body.lifetimeBudget === 'number' ? BigInt(Math.floor(body.lifetimeBudget)) : null,
      bidStrategy: typeof body.bidStrategy === 'string' ? body.bidStrategy : null,
      specialAdCategories: Array.isArray(body.specialAdCategories)
        ? (body.specialAdCategories.filter((x) => typeof x === 'string') as string[])
        : [],
    },
  });

  return NextResponse.json({ preset });
}

