import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { dnaRouteConfig, requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';
import { communicationDnaUpsertSchema } from '@/lib/brand-dna/schemas';
import { serializeCommunicationDna } from '@/lib/brand-dna/serialize';

export const dynamic = dnaRouteConfig.dynamic;
export const runtime = dnaRouteConfig.runtime;

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  const row = await prisma.communicationDna.findUnique({ where: { brandEntityId: brandId } });
  return NextResponse.json({ communicationDna: serializeCommunicationDna(row) });
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

  const parsed = communicationDnaUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const row = await prisma.communicationDna.upsert({
    where: { brandEntityId: brandId },
    create: { brandEntityId: brandId, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({ communicationDna: serializeCommunicationDna(row) });
}
