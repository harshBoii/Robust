import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';
import { visualDnaUpsertSchema } from '@/lib/brand-dna/schemas';
import { serializeVisualDna } from '@/lib/brand-dna/serialize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  const row = await prisma.visualDna.findUnique({ where: { brandEntityId: brandId } });
  return NextResponse.json({ visualDna: serializeVisualDna(row) });
}

export async function POST(req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = visualDnaUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const data = parsed.data;
  const row = await prisma.visualDna.upsert({
    where: { brandEntityId: brandId },
    create: { brandEntityId: brandId, ...data },
    update: data,
  });

  return NextResponse.json({ visualDna: serializeVisualDna(row) });
}
