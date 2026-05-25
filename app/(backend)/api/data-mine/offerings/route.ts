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

type PostBody = Record<string, unknown>;

export async function POST(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = trimOptionalString(body.name, 500);
  const slug = trimOptionalString(body.slug, 255);
  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  const brandEntity = await prisma.brandEntity.findUnique({
    where: { companyId: session!.companyId },
    select: { id: true },
  });

  if (!brandEntity) {
    return NextResponse.json(
      { error: 'Create a brand entity first (auto-fill or save brand fields)' },
      { status: 400 },
    );
  }

  const offeringType = parseOfferingType(body.offeringType) ?? 'PRODUCT';
  const description = trimOptionalString(body.description, 50000);
  const url = trimOptionalString(body.url, 1000);
  const keywords = parseStringArray(body.keywords) ?? [];
  const useCases = parseStringArray(body.useCases) ?? [];
  const targetAudiences = parseStringArray(body.targetAudiences) ?? [];
  const differentiators = parseStringArray(body.differentiators) ?? [];
  const competitors = parseStringArray(body.competitors) ?? [];
  const isPrimary = parseBoolean(body.isPrimary) ?? false;
  const isActive = parseBoolean(body.isActive) ?? true;

  try {
    const offering = await prisma.offering.create({
      data: {
        companyId: session!.companyId,
        brandEntityId: brandEntity.id,
        name,
        slug,
        description: description ?? null,
        offeringType,
        url: url ?? null,
        keywords,
        useCases,
        targetAudiences,
        differentiators,
        competitors,
        isPrimary,
        isActive,
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
    console.error('[data-mine offerings POST]', e);
    return NextResponse.json({ error: 'Failed to create offering' }, { status: 500 });
  }
}
