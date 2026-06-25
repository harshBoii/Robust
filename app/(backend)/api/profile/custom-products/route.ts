import { NextResponse } from 'next/server';

import { parseCustomProductBody } from '@/lib/custom-products/parse-body';
import { serializeCustomProduct } from '@/lib/custom-products/serialize';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const products = await prisma.customProduct.findMany({
    where: { companyId: session!.companyId },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    products: products.map(serializeCustomProduct),
  });
}

export async function POST(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseCustomProductBody(body);
  if (!parsed.name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const product = await prisma.customProduct.create({
      data: {
        companyId: session!.companyId,
        name: parsed.name,
        description: parsed.description ?? null,
        category: parsed.category ?? null,
        productType: parsed.productType ?? 'SERVICE',
        status: parsed.status ?? 'DRAFT',
        tagline: parsed.tagline ?? null,
        keyBenefits: parsed.keyBenefits ?? [],
        targetAudience: parsed.targetAudience ?? null,
        keywords: parsed.keywords ?? [],
        toneNotes: parsed.toneNotes ?? null,
        mediaUrls: parsed.mediaUrls ?? [],
        faqs: parsed.faqs ?? [],
        certifications: parsed.certifications ?? null,
      },
    });

    return NextResponse.json({ product: serializeCustomProduct(product) });
  } catch (e) {
    console.error('[custom-products POST]', e);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
