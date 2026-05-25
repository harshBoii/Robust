import { NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import { getDataMineSnapshot } from '@/lib/data-mine/get-data-mine';
import {
  parseBoolean,
  parseIntOptional,
  parseStringArray,
  trimOptionalString,
} from '@/lib/data-mine/parse-body';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const snapshot = await getDataMineSnapshot(session!.companyId);
  if (!snapshot) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json({ dataMine: snapshot });
}

type PatchBody = Record<string, unknown>;

export async function PATCH(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const website = trimOptionalString(body.website, 500);
  const linkedinUrl = trimOptionalString(body.linkedinUrl, 1000);

  const brand = body.brandEntity;
  const brandPatch =
    brand && typeof brand === 'object' && !Array.isArray(brand)
      ? (brand as Record<string, unknown>)
      : null;

  const hasCompanyFields = website !== undefined || linkedinUrl !== undefined;
  const hasBrandFields = brandPatch !== null;

  if (!hasCompanyFields && !hasBrandFields) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const companyId = session!.companyId;

  try {
    if (hasCompanyFields) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          ...(website !== undefined ? { website } : {}),
          ...(linkedinUrl !== undefined ? { linkedinUrl } : {}),
        },
      });
    }

    if (hasBrandFields && brandPatch) {
      const canonicalName = trimOptionalString(brandPatch.canonicalName, 255);
      const entityType = trimOptionalString(brandPatch.entityType, 64);
      const oneLiner = trimOptionalString(brandPatch.oneLiner, 10000);
      const about = trimOptionalString(brandPatch.about, 50000);
      const industry = trimOptionalString(brandPatch.industry, 255);
      const category = trimOptionalString(brandPatch.category, 255);
      const headquartersCity = trimOptionalString(brandPatch.headquartersCity, 255);
      const headquartersCountry = trimOptionalString(brandPatch.headquartersCountry, 255);
      const foundedYear = parseIntOptional(brandPatch.foundedYear);
      const employeeRange = trimOptionalString(brandPatch.employeeRange, 64);
      const businessModel = trimOptionalString(brandPatch.businessModel, 64);
      const aliases = parseStringArray(brandPatch.aliases);
      const topics = parseStringArray(brandPatch.topics);
      const keywords = parseStringArray(brandPatch.keywords);
      const targetAudiences = parseStringArray(brandPatch.targetAudiences);

      let branding: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
      if (brandPatch.branding !== undefined) {
        branding =
          brandPatch.branding === null
            ? Prisma.JsonNull
            : (brandPatch.branding as Prisma.InputJsonValue);
      }

      const existing = await prisma.brandEntity.findUnique({
        where: { companyId },
        select: { id: true },
      });

      const brandData = {
        ...(canonicalName !== undefined ? { canonicalName: canonicalName ?? 'Brand' } : {}),
        ...(aliases !== undefined ? { aliases } : {}),
        ...(entityType !== undefined ? { entityType } : {}),
        ...(oneLiner !== undefined ? { oneLiner } : {}),
        ...(about !== undefined ? { about } : {}),
        ...(industry !== undefined ? { industry } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(headquartersCity !== undefined ? { headquartersCity } : {}),
        ...(headquartersCountry !== undefined ? { headquartersCountry } : {}),
        ...(foundedYear !== undefined ? { foundedYear } : {}),
        ...(employeeRange !== undefined ? { employeeRange } : {}),
        ...(businessModel !== undefined ? { businessModel } : {}),
        ...(topics !== undefined ? { topics } : {}),
        ...(keywords !== undefined ? { keywords } : {}),
        ...(targetAudiences !== undefined ? { targetAudiences } : {}),
        ...(branding !== undefined ? { branding } : {}),
      };

      if (existing) {
        if (Object.keys(brandData).length > 0) {
          await prisma.brandEntity.update({
            where: { companyId },
            data: brandData,
          });
        }
      } else if (canonicalName) {
        await prisma.brandEntity.create({
          data: {
            companyId,
            canonicalName,
            aliases: aliases ?? [],
            entityType: entityType ?? null,
            oneLiner: oneLiner ?? null,
            about: about ?? null,
            industry: industry ?? null,
            category: category ?? null,
            headquartersCity: headquartersCity ?? null,
            headquartersCountry: headquartersCountry ?? null,
            foundedYear: foundedYear ?? null,
            employeeRange: employeeRange ?? null,
            businessModel: businessModel ?? null,
            topics: topics ?? [],
            keywords: keywords ?? [],
            targetAudiences: targetAudiences ?? [],
            branding:
              branding === undefined
                ? undefined
                : branding === Prisma.JsonNull
                  ? Prisma.JsonNull
                  : branding,
          },
        });
      }
    }

    const snapshot = await getDataMineSnapshot(companyId);
    return NextResponse.json({ dataMine: snapshot });
  } catch (e) {
    console.error('[data-mine PATCH]', e);
    return NextResponse.json({ error: 'Failed to update data mine' }, { status: 500 });
  }
}
