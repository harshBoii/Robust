import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { jsonSafe } from '@/lib/json-safe';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PatchBody = {
  name?: unknown;
  isDefault?: unknown;
  objective?: unknown;
  status?: unknown;
  spendCap?: unknown;
  dailyBudget?: unknown;
  lifetimeBudget?: unknown;
  bidStrategy?: unknown;
  specialAdCategories?: unknown;
  isAdsetBudgetSharingEnabled?: unknown;
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const existing = await prisma.campaignPreset.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const preset = await prisma.campaignPreset.update({
    where: { id: existing.id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.isDefault === 'boolean' ? { isDefault: body.isDefault } : {}),
      ...(typeof body.objective === 'string' || body.objective === null ? { objective: body.objective as string | null } : {}),
      ...(typeof body.status === 'string' || body.status === null ? { status: body.status as string | null } : {}),
      ...(typeof body.spendCap === 'number' || body.spendCap === null
        ? { spendCap: body.spendCap == null ? null : BigInt(Math.floor(body.spendCap)) }
        : {}),
      ...(typeof body.dailyBudget === 'number' || body.dailyBudget === null
        ? { dailyBudget: body.dailyBudget == null ? null : BigInt(Math.floor(body.dailyBudget)) }
        : {}),
      ...(typeof body.lifetimeBudget === 'number' || body.lifetimeBudget === null
        ? { lifetimeBudget: body.lifetimeBudget == null ? null : BigInt(Math.floor(body.lifetimeBudget)) }
        : {}),
      ...(typeof body.bidStrategy === 'string' || body.bidStrategy === null ? { bidStrategy: body.bidStrategy as string | null } : {}),
      ...(Array.isArray(body.specialAdCategories)
        ? { specialAdCategories: body.specialAdCategories.filter((x) => typeof x === 'string') as string[] }
        : {}),
      ...(typeof body.isAdsetBudgetSharingEnabled === 'boolean'
        ? { isAdsetBudgetSharingEnabled: body.isAdsetBudgetSharingEnabled }
        : body.isAdsetBudgetSharingEnabled === null
          ? { isAdsetBudgetSharingEnabled: null }
          : {}),
    },
  });

  return NextResponse.json({ preset: jsonSafe(preset) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing = await prisma.campaignPreset.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.campaignPreset.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}

