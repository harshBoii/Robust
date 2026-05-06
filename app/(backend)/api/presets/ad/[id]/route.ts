import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PatchBody = {
  name?: unknown;
  isDefault?: unknown;
  headline?: unknown;
  landingPageUrl?: unknown;
  budgetOverride?: unknown;
  targetAgeMin?: unknown;
  targetAgeMax?: unknown;
  targetGenders?: unknown;
  targetProfessions?: unknown;
  pixelIds?: unknown;
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

  const existing = await prisma.adPreset.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const preset = await prisma.adPreset.update({
    where: { id: existing.id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.isDefault === 'boolean' ? { isDefault: body.isDefault } : {}),
      ...(typeof body.headline === 'string' || body.headline === null ? { headline: body.headline as string | null } : {}),
      ...(typeof body.landingPageUrl === 'string' || body.landingPageUrl === null ? { landingPageUrl: body.landingPageUrl as string | null } : {}),
      ...(typeof body.budgetOverride === 'number' || body.budgetOverride === null ? { budgetOverride: body.budgetOverride as number | null } : {}),
      ...(typeof body.targetAgeMin === 'number' || body.targetAgeMin === null ? { targetAgeMin: body.targetAgeMin as number | null } : {}),
      ...(typeof body.targetAgeMax === 'number' || body.targetAgeMax === null ? { targetAgeMax: body.targetAgeMax as number | null } : {}),
      ...(Array.isArray(body.targetGenders)
        ? { targetGenders: body.targetGenders.filter((x) => typeof x === 'string') as string[] }
        : {}),
      ...(Array.isArray(body.targetProfessions)
        ? { targetProfessions: body.targetProfessions.filter((x) => typeof x === 'string') as string[] }
        : {}),
      ...(Array.isArray(body.pixelIds)
        ? { pixelIds: body.pixelIds.filter((x) => typeof x === 'string') as string[] }
        : {}),
    },
  });

  return NextResponse.json({ preset });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing = await prisma.adPreset.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.adPreset.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}

