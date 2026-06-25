import { NextResponse } from 'next/server';

import { parseCustomProductBody } from '@/lib/custom-products/parse-body';
import { serializeCustomProduct } from '@/lib/custom-products/serialize';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const { id } = await params;

  const product = await prisma.customProduct.findFirst({
    where: { id, companyId: session!.companyId },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ product: serializeCustomProduct(product) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseCustomProductBody(body);

  if (
    parsed.name === undefined &&
    parsed.description === undefined &&
    parsed.category === undefined &&
    parsed.productType === undefined &&
    parsed.status === undefined &&
    parsed.tagline === undefined &&
    parsed.keyBenefits === undefined &&
    parsed.targetAudience === undefined &&
    parsed.keywords === undefined &&
    parsed.toneNotes === undefined &&
    parsed.mediaUrls === undefined &&
    parsed.faqs === undefined &&
    parsed.certifications === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const existing = await prisma.customProduct.findFirst({
    where: { id, companyId: session!.companyId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    const product = await prisma.customProduct.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name ?? existing.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.productType !== undefined ? { productType: parsed.productType } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.tagline !== undefined ? { tagline: parsed.tagline } : {}),
        ...(parsed.keyBenefits !== undefined ? { keyBenefits: parsed.keyBenefits } : {}),
        ...(parsed.targetAudience !== undefined ? { targetAudience: parsed.targetAudience } : {}),
        ...(parsed.keywords !== undefined ? { keywords: parsed.keywords } : {}),
        ...(parsed.toneNotes !== undefined ? { toneNotes: parsed.toneNotes } : {}),
        ...(parsed.mediaUrls !== undefined ? { mediaUrls: parsed.mediaUrls } : {}),
        ...(parsed.faqs !== undefined ? { faqs: parsed.faqs } : {}),
        ...(parsed.certifications !== undefined ? { certifications: parsed.certifications } : {}),
      },
    });

    return NextResponse.json({ product: serializeCustomProduct(product) });
  } catch (e) {
    console.error('[custom-products PATCH]', e);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.customProduct.findFirst({
    where: { id, companyId: session!.companyId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  await prisma.customProduct.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
