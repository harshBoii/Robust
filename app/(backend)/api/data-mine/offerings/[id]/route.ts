import { NextResponse } from 'next/server';

import {
  parseBoolean,
  parseOfferingType,
  parseStringArray,
  trimOptionalString,
} from '@/lib/data-mine/parse-body';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PatchBody = Record<string, unknown>;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = trimOptionalString(body.name, 500);
  const slug = trimOptionalString(body.slug, 255);
  const description = trimOptionalString(body.description, 50000);
  const url = trimOptionalString(body.url, 1000);
  const offeringType = parseOfferingType(body.offeringType);
  const keywords = parseStringArray(body.keywords);
  const useCases = parseStringArray(body.useCases);
  const targetAudiences = parseStringArray(body.targetAudiences);
  const differentiators = parseStringArray(body.differentiators);
  const competitors = parseStringArray(body.competitors);
  const isPrimary = parseBoolean(body.isPrimary);
  const isActive = parseBoolean(body.isActive);

  if (
    name === undefined &&
    slug === undefined &&
    description === undefined &&
    url === undefined &&
    offeringType === undefined &&
    keywords === undefined &&
    useCases === undefined &&
    targetAudiences === undefined &&
    differentiators === undefined &&
    competitors === undefined &&
    isPrimary === undefined &&
    isActive === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const existing = await prisma.offering.findFirst({
    where: { id, companyId: session!.companyId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  try {
    const offering = await prisma.offering.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name ?? existing.name } : {}),
        ...(slug !== undefined ? { slug: slug ?? existing.slug } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(offeringType !== undefined ? { offeringType } : {}),
        ...(keywords !== undefined ? { keywords } : {}),
        ...(useCases !== undefined ? { useCases } : {}),
        ...(targetAudiences !== undefined ? { targetAudiences } : {}),
        ...(differentiators !== undefined ? { differentiators } : {}),
        ...(competitors !== undefined ? { competitors } : {}),
        ...(isPrimary !== undefined ? { isPrimary } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({
      offering: {
        ...offering,
        createdAt: offering.createdAt.toISOString(),
        updatedAt: offering.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('[data-mine offerings PATCH]', e);
    return NextResponse.json({ error: 'Failed to update offering' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.offering.findFirst({
    where: { id, companyId: session!.companyId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
  }

  await prisma.offering.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
