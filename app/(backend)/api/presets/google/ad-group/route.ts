import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/app/generated/prisma/client';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const presets = await prisma.googleAdGroupPreset.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ presets });
}

type PostBody = {
  name?: unknown;
  keywords?: unknown;
  targeting?: unknown;
  cpcBidMicros?: unknown;
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

  const preset = await prisma.googleAdGroupPreset.create({
    data: {
      companyId: session.companyId,
      name,
      keywords: (Array.isArray(body.keywords) ? body.keywords : []) as Prisma.InputJsonValue,
      targeting: (
        typeof body.targeting === 'object' && body.targeting !== null ? body.targeting : {}
      ) as Prisma.InputJsonValue,
      cpcBidMicros:
        typeof body.cpcBidMicros === 'number' ? BigInt(Math.round(body.cpcBidMicros)) : null,
      isDefault: body.isDefault === true,
    },
  });

  return NextResponse.json({ preset }, { status: 201 });
}
