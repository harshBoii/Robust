import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const presets = await prisma.adPreset.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });

  return NextResponse.json({ presets });
}

type PostBody = {
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

  const preset = await prisma.adPreset.create({
    data: {
      companyId: session.companyId,
      name,
      isDefault: Boolean(body.isDefault),
      headline: typeof body.headline === 'string' ? body.headline : null,
      landingPageUrl: typeof body.landingPageUrl === 'string' ? body.landingPageUrl : null,
      budgetOverride: typeof body.budgetOverride === 'number' ? body.budgetOverride : null,
      targetAgeMin: typeof body.targetAgeMin === 'number' ? body.targetAgeMin : null,
      targetAgeMax: typeof body.targetAgeMax === 'number' ? body.targetAgeMax : null,
      targetGenders: Array.isArray(body.targetGenders) ? (body.targetGenders.filter((x) => typeof x === 'string') as string[]) : [],
      targetProfessions: Array.isArray(body.targetProfessions) ? (body.targetProfessions.filter((x) => typeof x === 'string') as string[]) : [],
      pixelIds: Array.isArray(body.pixelIds) ? (body.pixelIds.filter((x) => typeof x === 'string') as string[]) : [],
    },
  });

  return NextResponse.json({ preset });
}

