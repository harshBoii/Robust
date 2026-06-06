import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const presets = await prisma.googleAssetGroupPreset.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ presets });
}

type PostBody = {
  name?: unknown;
  finalUrl?: unknown;
  path1?: unknown;
  path2?: unknown;
  headlines?: unknown;
  descriptions?: unknown;
  longHeadline?: unknown;
  businessName?: unknown;
  isDefault?: unknown;
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

  const preset = await prisma.googleAssetGroupPreset.create({
    data: {
      companyId: session.companyId,
      name,
      finalUrl: typeof body.finalUrl === 'string' ? body.finalUrl : null,
      path1: typeof body.path1 === 'string' ? body.path1 : null,
      path2: typeof body.path2 === 'string' ? body.path2 : null,
      headlines: Array.isArray(body.headlines) ? body.headlines : [],
      descriptions: Array.isArray(body.descriptions) ? body.descriptions : [],
      longHeadline: typeof body.longHeadline === 'string' ? body.longHeadline : null,
      businessName: typeof body.businessName === 'string' ? body.businessName : null,
      isDefault: body.isDefault === true,
    },
  });

  return NextResponse.json({ preset }, { status: 201 });
}
