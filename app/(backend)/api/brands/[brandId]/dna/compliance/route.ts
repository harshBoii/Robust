import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';
import { complianceDnaUpsertSchema } from '@/lib/brand-dna/schemas';
import { serializeComplianceDna } from '@/lib/brand-dna/serialize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  const row = await prisma.complianceDna.findUnique({ where: { brandEntityId: brandId } });
  return NextResponse.json({ complianceDna: serializeComplianceDna(row) });
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

  const parsed = complianceDnaUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const data = {
    bannedAbsoluteClaims: parsed.data.bannedAbsoluteClaims ?? [],
    bannedComparativeClaims: parsed.data.bannedComparativeClaims ?? [],
    allowedClaims: parsed.data.allowedClaims ?? [],
    bannedWords: parsed.data.bannedWords ?? [],
    allowedWords: parsed.data.allowedWords ?? [],
    fearBasedMarketingAllowed: parsed.data.fearBasedMarketingAllowed ?? false,
    sensationalLanguageAllowed: parsed.data.sensationalLanguageAllowed ?? false,
    politicalContentAllowed: parsed.data.politicalContentAllowed ?? false,
    religiousContentAllowed: parsed.data.religiousContentAllowed ?? false,
    controversialTopicsAllowed: parsed.data.controversialTopicsAllowed ?? false,
    sourceFileUrl: parsed.data.sourceFileUrl ?? null,
    sourceFileName: parsed.data.sourceFileName ?? null,
  };

  const row = await prisma.complianceDna.upsert({
    where: { brandEntityId: brandId },
    create: { brandEntityId: brandId, ...data },
    update: data,
  });

  return NextResponse.json({ complianceDna: serializeComplianceDna(row) });
}
