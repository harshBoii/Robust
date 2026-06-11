import 'server-only';

import { NextResponse } from 'next/server';

import { requireProfileSession } from '@/lib/profile/api-auth';

import { buildBrandProfile } from './build-brand-profile';
import { requireBrandForSession } from './require-brand';

export async function requireBrandDnaSession(brandId: string) {
  const { session, error } = await requireProfileSession();
  if (error) return { error, session: null, brand: null };

  const brand = await requireBrandForSession(brandId, session!.companyId);
  if (!brand) {
    return {
      error: NextResponse.json({ error: 'Brand not found' }, { status: 404 }),
      session: null,
      brand: null,
    };
  }

  return { error: null, session: session!, brand };
}

export function brandProfileFromEntity(
  brand: NonNullable<Awaited<ReturnType<typeof requireBrandForSession>>>,
) {
  const primaryOffering = brand.offerings.find((o) => o.isPrimary) ?? brand.offerings[0] ?? null;
  return buildBrandProfile({
    brandEntity: brand,
    company: brand.company,
    primaryOffering,
  });
}
